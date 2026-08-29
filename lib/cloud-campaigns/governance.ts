import type { User } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { CloudCampaignError } from '@/lib/cloud-campaigns/server'
import type { CampaignAdministrationMode } from '@/lib/aigm/campaign-storage'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const RECOVERY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

type CampaignRecord = {
  id: string
  name: string
  mode: 'solo' | 'multiplayer'
  administration_mode: CampaignAdministrationMode
  created_by_user_id: string | null
  coordinator_user_id: string | null
}

type MemberRow = {
  user_id: string
  display_name: string
  joined_at: string
}

type ProposalRow = {
  id: string
  proposal_type: 'remove_member' | 'delete_campaign'
  target_user_id: string | null
  proposed_by_user_id: string
  created_at: string
}

type VoteRow = {
  proposal_id: string
  user_id: string
  vote: 'approve' | 'oppose'
}

function validId(value: unknown, label = 'campaign') {
  const id = typeof value === 'string' ? value.trim() : ''
  if (!UUID_PATTERN.test(id)) throw new CloudCampaignError(`That ${label} ID is not valid.`, 400, `invalid_${label}_id`)
  return id
}

export function cloudMemberDisplayName(user: User) {
  const metadata = user.user_metadata as Record<string, unknown> | undefined
  const metadataName = metadata && typeof metadata.display_name === 'string' ? metadata.display_name : ''
  const fullName = metadata && typeof metadata.full_name === 'string' ? metadata.full_name : ''
  const emailName = user.email?.split('@')[0] ?? ''
  const clean = (metadataName || fullName || emailName || 'Player').replace(/\s+/g, ' ').trim()
  return clean.slice(0, 48) || 'Player'
}

async function campaignForMember(userId: string, rawCampaignId: unknown): Promise<CampaignRecord> {
  const campaignId = validId(rawCampaignId)
  const admin = createAdminClient()
  const { data: membership, error: membershipError } = await admin
    .from('campaign_members')
    .select('campaign_id')
    .eq('campaign_id', campaignId)
    .eq('user_id', userId)
    .eq('membership_status', 'active')
    .maybeSingle()
  if (membershipError) throw new CloudCampaignError(membershipError.message, 503, 'cloud_campaign_database_unavailable')
  if (!membership) throw new CloudCampaignError('That cloud campaign is not available to this account.', 404, 'campaign_not_found')

  const { data, error } = await admin
    .from('campaigns')
    .select('id, name, mode, administration_mode, created_by_user_id, coordinator_user_id')
    .eq('id', campaignId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new CloudCampaignError(error.message, 503, 'cloud_campaign_database_unavailable')
  if (!data) throw new CloudCampaignError('That cloud campaign is no longer available.', 404, 'campaign_not_found')

  return {
    id: data.id as string,
    name: data.name as string,
    mode: data.mode === 'multiplayer' ? 'multiplayer' : 'solo',
    administration_mode: data.administration_mode === 'shared' || data.administration_mode === 'coordinator' ? data.administration_mode : 'solo',
    created_by_user_id: typeof data.created_by_user_id === 'string' ? data.created_by_user_id : null,
    coordinator_user_id: typeof data.coordinator_user_id === 'string' ? data.coordinator_user_id : null,
  }
}

async function activeMembers(campaignId: string): Promise<MemberRow[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('campaign_members')
    .select('user_id, display_name, joined_at')
    .eq('campaign_id', campaignId)
    .eq('membership_status', 'active')
    .order('joined_at', { ascending: true })
  if (error) throw new CloudCampaignError(error.message, 503, 'cloud_campaign_database_unavailable')
  return (data ?? []).map((row: { user_id: string; display_name: string; joined_at: string }) => ({
    user_id: row.user_id,
    display_name: row.display_name || 'Player',
    joined_at: row.joined_at,
  }))
}

async function deactivateMemberSeats(campaignId: string, userId: string) {
  const admin = createAdminClient()
  const { data: sessions, error: sessionError } = await admin
    .from('multiplayer_sessions')
    .select('id')
    .eq('campaign_id', campaignId)
    .neq('status', 'closed')
  if (sessionError) throw new CloudCampaignError(sessionError.message, 503, 'multiplayer_database_unavailable')
  const sessionIds = (sessions ?? []).map((row: { id: string }) => row.id)
  if (!sessionIds.length) return

  const { data: seats, error: seatQueryError } = await admin
    .from('multiplayer_seats')
    .select('id')
    .in('session_id', sessionIds)
    .eq('user_id', userId)
    .eq('is_active', true)
  if (seatQueryError) throw new CloudCampaignError(seatQueryError.message, 503, 'multiplayer_database_unavailable')
  const seatIds = (seats ?? []).map((row: { id: string }) => row.id)
  if (!seatIds.length) return

  const { error: claimError } = await admin.from('multiplayer_character_claims').delete().in('seat_id', seatIds)
  if (claimError) throw new CloudCampaignError(claimError.message, 503, 'multiplayer_database_unavailable')
  const { error: seatError } = await admin
    .from('multiplayer_seats')
    .update({ is_active: false, character_id: null, updated_at: new Date().toISOString() })
    .in('id', seatIds)
  if (seatError) throw new CloudCampaignError(seatError.message, 503, 'multiplayer_database_unavailable')
}

async function closeCampaignSessions(campaignId: string) {
  const admin = createAdminClient()
  const { error } = await admin
    .from('multiplayer_sessions')
    .update({ status: 'closed', updated_at: new Date().toISOString() })
    .eq('campaign_id', campaignId)
    .neq('status', 'closed')
  if (error) throw new CloudCampaignError(error.message, 503, 'multiplayer_database_unavailable')
}

async function softDeleteCampaign(campaignId: string) {
  const admin = createAdminClient()
  const now = new Date()
  const { error } = await admin
    .from('campaigns')
    .update({ deleted_at: now.toISOString(), purge_after: new Date(now.getTime() + RECOVERY_WINDOW_MS).toISOString() })
    .eq('id', campaignId)
    .is('deleted_at', null)
  if (error) throw new CloudCampaignError(error.message, 503, 'cloud_campaign_database_unavailable')
  await closeCampaignSessions(campaignId)
}

async function executeProposalIfReady(campaign: CampaignRecord, proposalId: string) {
  const admin = createAdminClient()
  const { data: proposal, error: proposalError } = await admin
    .from('campaign_governance_proposals')
    .select('id, proposal_type, target_user_id, status')
    .eq('id', proposalId)
    .eq('campaign_id', campaign.id)
    .maybeSingle()
  if (proposalError) throw new CloudCampaignError(proposalError.message, 503, 'cloud_campaign_database_unavailable')
  if (!proposal || proposal.status !== 'open') return false

  const members = await activeMembers(campaign.id)
  const eligible = members.filter((member) => proposal.proposal_type !== 'remove_member' || member.user_id !== proposal.target_user_id)
  if (!eligible.length) return false

  const { data: votes, error: voteError } = await admin
    .from('campaign_governance_votes')
    .select('user_id, vote')
    .eq('proposal_id', proposalId)
  if (voteError) throw new CloudCampaignError(voteError.message, 503, 'cloud_campaign_database_unavailable')
  const approvals = new Set((votes ?? []).filter((vote: { user_id: string; vote: string }) => vote.vote === 'approve').map((vote: { user_id: string }) => vote.user_id))
  if (!eligible.every((member) => approvals.has(member.user_id))) return false

  if (proposal.proposal_type === 'remove_member' && typeof proposal.target_user_id === 'string') {
    const { error } = await admin
      .from('campaign_members')
      .update({ membership_status: 'removed' })
      .eq('campaign_id', campaign.id)
      .eq('user_id', proposal.target_user_id)
      .eq('membership_status', 'active')
    if (error) throw new CloudCampaignError(error.message, 503, 'cloud_campaign_database_unavailable')
    await deactivateMemberSeats(campaign.id, proposal.target_user_id)
  } else if (proposal.proposal_type === 'delete_campaign') {
    await softDeleteCampaign(campaign.id)
  }

  const { error: resolveError } = await admin
    .from('campaign_governance_proposals')
    .update({ status: 'executed', resolved_at: new Date().toISOString() })
    .eq('id', proposalId)
    .eq('status', 'open')
  if (resolveError) throw new CloudCampaignError(resolveError.message, 503, 'cloud_campaign_database_unavailable')
  return true
}

export async function loadCampaignGovernance(user: User, rawCampaignId: unknown) {
  const campaign = await campaignForMember(user.id, rawCampaignId)
  const members = await activeMembers(campaign.id)
  const admin = createAdminClient()
  const { data: proposals, error: proposalError } = await admin
    .from('campaign_governance_proposals')
    .select('id, proposal_type, target_user_id, proposed_by_user_id, created_at')
    .eq('campaign_id', campaign.id)
    .eq('status', 'open')
    .order('created_at', { ascending: true })
  if (proposalError) throw new CloudCampaignError(proposalError.message, 503, 'cloud_campaign_database_unavailable')

  const proposalRows = (proposals ?? []) as ProposalRow[]
  const proposalIds = proposalRows.map((proposal) => proposal.id)
  let voteRows: VoteRow[] = []
  if (proposalIds.length) {
    const { data: votes, error: voteError } = await admin
      .from('campaign_governance_votes')
      .select('proposal_id, user_id, vote')
      .in('proposal_id', proposalIds)
    if (voteError) throw new CloudCampaignError(voteError.message, 503, 'cloud_campaign_database_unavailable')
    voteRows = (votes ?? []) as VoteRow[]
  }

  const displayByUser = new Map(members.map((member) => [member.user_id, member.display_name]))
  const decisions = proposalRows.map((proposal) => {
    const eligible = members.filter((member) => proposal.proposal_type !== 'remove_member' || member.user_id !== proposal.target_user_id)
    const eligibleIds = new Set(eligible.map((member) => member.user_id))
    const proposalVotes = voteRows.filter((vote) => vote.proposal_id === proposal.id && eligibleIds.has(vote.user_id))
    return {
      id: proposal.id,
      type: proposal.proposal_type,
      target_user_id: proposal.target_user_id,
      target_display_name: proposal.target_user_id ? displayByUser.get(proposal.target_user_id) || 'Campaign member' : null,
      proposed_by_display_name: displayByUser.get(proposal.proposed_by_user_id) || 'Campaign member',
      approvals: proposalVotes.filter((vote) => vote.vote === 'approve').length,
      oppositions: proposalVotes.filter((vote) => vote.vote === 'oppose').length,
      required: eligible.length,
      my_vote: proposalVotes.find((vote) => vote.user_id === user.id)?.vote ?? null,
      can_vote: eligibleIds.has(user.id),
      created_at: proposal.created_at,
    }
  })

  const selfCoordinator = campaign.administration_mode === 'coordinator' && campaign.coordinator_user_id === user.id
  return {
    campaign_id: campaign.id,
    campaign_name: campaign.name,
    campaign_mode: campaign.mode,
    administration_mode: campaign.administration_mode,
    is_coordinator: selfCoordinator,
    can_leave: campaign.mode === 'multiplayer' && !selfCoordinator,
    can_delete_directly: campaign.administration_mode === 'solo'
      ? campaign.created_by_user_id === user.id
      : selfCoordinator,
    members: members.map((member) => ({
      user_id: member.user_id,
      display_name: member.display_name,
      is_self: member.user_id === user.id,
      is_coordinator: member.user_id === campaign.coordinator_user_id,
      joined_at: member.joined_at,
    })),
    decisions,
  }
}

export async function actOnCampaignGovernance(user: User, rawCampaignId: unknown, input: Record<string, unknown>) {
  const campaign = await campaignForMember(user.id, rawCampaignId)
  const action = typeof input.action === 'string' ? input.action : ''
  const admin = createAdminClient()

  if (action === 'leave') {
    if (campaign.mode !== 'multiplayer') throw new CloudCampaignError('Solo campaigns are deleted rather than left.', 409, 'solo_campaign_cannot_leave')
    if (campaign.administration_mode === 'coordinator' && campaign.coordinator_user_id === user.id) {
      throw new CloudCampaignError('Transfer coordinator control before leaving this campaign.', 409, 'transfer_coordinator_first')
    }
    const { error } = await admin
      .from('campaign_members')
      .update({ membership_status: 'left' })
      .eq('campaign_id', campaign.id)
      .eq('user_id', user.id)
      .eq('membership_status', 'active')
    if (error) throw new CloudCampaignError(error.message, 503, 'cloud_campaign_database_unavailable')
    await deactivateMemberSeats(campaign.id, user.id)
    return { action: 'left' as const }
  }

  if (action === 'delete') {
    const allowed = campaign.administration_mode === 'solo'
      ? campaign.created_by_user_id === user.id
      : campaign.administration_mode === 'coordinator' && campaign.coordinator_user_id === user.id
    if (!allowed) throw new CloudCampaignError('This campaign uses Shared Control. Start a group deletion vote instead.', 403, 'group_approval_required')
    await softDeleteCampaign(campaign.id)
    return { action: 'deleted' as const, recovery_days: 7 }
  }

  if (action === 'remove_member') {
    if (campaign.administration_mode !== 'coordinator' || campaign.coordinator_user_id !== user.id) {
      throw new CloudCampaignError('Shared Control removes members through a group vote.', 403, 'group_approval_required')
    }
    const targetUserId = validId(input.target_user_id, 'user')
    if (targetUserId === user.id) throw new CloudCampaignError('Transfer coordinator control before leaving the campaign.', 409, 'transfer_coordinator_first')
    const { error } = await admin
      .from('campaign_members')
      .update({ membership_status: 'removed' })
      .eq('campaign_id', campaign.id)
      .eq('user_id', targetUserId)
      .eq('membership_status', 'active')
    if (error) throw new CloudCampaignError(error.message, 503, 'cloud_campaign_database_unavailable')
    await deactivateMemberSeats(campaign.id, targetUserId)
    return { action: 'member_removed' as const }
  }

  if (action === 'transfer_coordinator') {
    if (campaign.administration_mode !== 'coordinator' || campaign.coordinator_user_id !== user.id) {
      throw new CloudCampaignError('Only the current coordinator can transfer coordinator control.', 403, 'coordinator_required')
    }
    const targetUserId = validId(input.target_user_id, 'user')
    if (targetUserId === user.id) return { action: 'coordinator_transferred' as const }
    const members = await activeMembers(campaign.id)
    if (!members.some((member) => member.user_id === targetUserId)) throw new CloudCampaignError('Choose a current campaign member.', 400, 'member_required')
    const { error } = await admin
      .from('campaigns')
      .update({ coordinator_user_id: targetUserId })
      .eq('id', campaign.id)
      .eq('coordinator_user_id', user.id)
    if (error) throw new CloudCampaignError(error.message, 503, 'cloud_campaign_database_unavailable')
    await admin.from('multiplayer_sessions').update({ coordinator_user_id: targetUserId, updated_at: new Date().toISOString() }).eq('campaign_id', campaign.id).neq('status', 'closed')
    return { action: 'coordinator_transferred' as const }
  }

  if (action === 'propose_delete' || action === 'propose_remove') {
    if (campaign.administration_mode !== 'shared') throw new CloudCampaignError('This campaign does not use Shared Control.', 409, 'shared_control_required')
    const proposalType = action === 'propose_delete' ? 'delete_campaign' : 'remove_member'
    const targetUserId = proposalType === 'remove_member' ? validId(input.target_user_id, 'user') : null
    if (targetUserId === user.id) throw new CloudCampaignError('Use Leave campaign to remove yourself.', 400, 'use_leave_campaign')
    if (targetUserId) {
      const members = await activeMembers(campaign.id)
      if (!members.some((member) => member.user_id === targetUserId)) throw new CloudCampaignError('That person is not a current campaign member.', 400, 'member_required')
    }

    const insert = await admin.from('campaign_governance_proposals').insert({
      campaign_id: campaign.id,
      proposal_type: proposalType,
      target_user_id: targetUserId,
      proposed_by_user_id: user.id,
      status: 'open',
    }).select('id').single()

    let proposalId: string
    if (insert.error) {
      if (!/duplicate|unique/i.test(insert.error.message)) throw new CloudCampaignError(insert.error.message, 503, 'cloud_campaign_database_unavailable')
      const query = admin
        .from('campaign_governance_proposals')
        .select('id')
        .eq('campaign_id', campaign.id)
        .eq('proposal_type', proposalType)
        .eq('status', 'open')
      const { data: existing, error: existingError } = targetUserId ? await query.eq('target_user_id', targetUserId).maybeSingle() : await query.is('target_user_id', null).maybeSingle()
      if (existingError || !existing) throw new CloudCampaignError(existingError?.message || 'That group decision could not be opened.', 503, 'cloud_campaign_database_unavailable')
      proposalId = existing.id as string
    } else {
      proposalId = insert.data.id as string
    }

    const { error: voteError } = await admin.from('campaign_governance_votes').upsert({
      proposal_id: proposalId,
      user_id: user.id,
      vote: 'approve',
      voted_at: new Date().toISOString(),
    }, { onConflict: 'proposal_id,user_id' })
    if (voteError) throw new CloudCampaignError(voteError.message, 503, 'cloud_campaign_database_unavailable')
    await executeProposalIfReady(campaign, proposalId)
    return { action: 'proposal_opened' as const, proposal_id: proposalId }
  }

  if (action === 'vote') {
    if (campaign.administration_mode !== 'shared') throw new CloudCampaignError('This campaign does not use Shared Control.', 409, 'shared_control_required')
    const proposalId = validId(input.proposal_id, 'proposal')
    const vote = input.vote === 'oppose' ? 'oppose' : input.vote === 'approve' ? 'approve' : null
    if (!vote) throw new CloudCampaignError('Choose Approve or Do not approve.', 400, 'vote_required')

    const { data: proposal, error: proposalError } = await admin
      .from('campaign_governance_proposals')
      .select('proposal_type, target_user_id, status')
      .eq('id', proposalId)
      .eq('campaign_id', campaign.id)
      .maybeSingle()
    if (proposalError) throw new CloudCampaignError(proposalError.message, 503, 'cloud_campaign_database_unavailable')
    if (!proposal || proposal.status !== 'open') throw new CloudCampaignError('That group decision is no longer open.', 409, 'proposal_closed')
    if (proposal.proposal_type === 'remove_member' && proposal.target_user_id === user.id) {
      throw new CloudCampaignError('The member being considered for removal does not vote on that decision.', 403, 'not_eligible_to_vote')
    }

    const { error: voteError } = await admin.from('campaign_governance_votes').upsert({
      proposal_id: proposalId,
      user_id: user.id,
      vote,
      voted_at: new Date().toISOString(),
    }, { onConflict: 'proposal_id,user_id' })
    if (voteError) throw new CloudCampaignError(voteError.message, 503, 'cloud_campaign_database_unavailable')
    const executed = vote === 'approve' ? await executeProposalIfReady(campaign, proposalId) : false
    return { action: executed ? 'proposal_executed' as const : 'vote_recorded' as const }
  }

  throw new CloudCampaignError('That campaign-control action is not supported.', 400, 'invalid_campaign_action')
}
