'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function requiredText(formData: FormData, name: string) {
  const value = formData.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

function safeReturnTo(formData: FormData) {
  const raw = requiredText(formData, 'returnTo')
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/account'
  return raw
}

function redirectWithQuery(pathname: string, key: string, value: string) {
  const url = new URL(pathname, 'https://rpgyourway.local')
  url.searchParams.set(key, value)
  redirect(`${url.pathname}${url.search}${url.hash}`)
}

function redirectError(returnTo: string, message: string) {
  if (returnTo === '/account') redirectWithQuery(returnTo, 'error', message)
  redirectWithQuery(returnTo, 'authError', message)
}

export async function signIn(formData: FormData) {
  const email = requiredText(formData, 'email')
  const password = requiredText(formData, 'password')
  const returnTo = safeReturnTo(formData)

  if (!email || !password) redirectError(returnTo, 'Enter your email and password.')

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) redirectError(returnTo, error.message)
  if (returnTo === '/account') redirectWithQuery(returnTo, 'status', 'signed-in')
  redirect(returnTo)
}

export async function signUp(formData: FormData) {
  const email = requiredText(formData, 'email')
  const password = requiredText(formData, 'password')
  const confirmPassword = requiredText(formData, 'confirmPassword')
  const returnTo = safeReturnTo(formData)

  if (!confirmPassword) redirectError(returnTo, 'Enter your password twice.')
  if (!email || !password) redirectError(returnTo, 'Enter your email address and choose a password.')
  if (password.length < 8) redirectError(returnTo, 'Use at least 8 characters for your password.')

  if (password !== confirmPassword) redirectError(returnTo, 'Those passwords do not match. Enter the same password twice.')

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({ email, password })

  if (error) redirectError(returnTo, error.message)

  if (data.session) {
    if (returnTo === '/account') redirectWithQuery(returnTo, 'status', 'created')
    redirect(returnTo)
  }

  if (returnTo === '/account') redirectWithQuery(returnTo, 'status', 'check-email')
  redirectWithQuery(returnTo, 'authStatus', 'check-email')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirectWithQuery('/account', 'status', 'signed-out')
}

export async function deleteAccount(formData: FormData) {
  const confirmation = requiredText(formData, 'confirmDelete')
  if (confirmation !== 'DELETE') redirectWithQuery('/account', 'error', 'Account deletion was not confirmed.')

  const supabase = await createClient()
  const { data, error: userError } = await supabase.auth.getUser()
  const userId = data.user?.id
  if (userError || !userId) return redirectWithQuery('/account', 'error', 'Sign in before deleting your account.')

  try {
    const admin = createAdminClient()
    const { data: memberships, error: membershipError } = await admin
      .from('campaign_members')
      .select('campaign_id')
      .eq('user_id', userId)
      .eq('membership_status', 'active')
    if (membershipError) redirectWithQuery('/account', 'error', membershipError.message)

    for (const membership of memberships ?? []) {
      const campaignId = membership.campaign_id as string
      const { count, error: countError } = await admin
        .from('campaign_members')
        .select('campaign_id', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
        .eq('membership_status', 'active')
        .neq('user_id', userId)
      if (countError) redirectWithQuery('/account', 'error', countError.message)
      if ((count ?? 0) === 0) {
        const { error: campaignError } = await admin.from('campaigns').delete().eq('id', campaignId)
        if (campaignError) redirectWithQuery('/account', 'error', campaignError.message)
      } else {
        const { error: memberError } = await admin.from('campaign_members').delete().eq('campaign_id', campaignId).eq('user_id', userId)
        if (memberError) redirectWithQuery('/account', 'error', memberError.message)
      }
    }

    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) redirectWithQuery('/account', 'error', error.message)
  } catch (error) {
    redirectWithQuery('/account', 'error', error instanceof Error ? error.message : 'RPG Your Way could not delete the account.')
  }

  await supabase.auth.signOut()
  redirectWithQuery('/account', 'status', 'account-deleted')
}
