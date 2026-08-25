import {
  ADVENTURE_INDEX_KEY,
  ADVENTURE_MIGRATION_PREFIX,
  CURRENT_ADVENTURE_KEY,
  adventureStorageKey,
  canonicalAdventureName,
  deleteAdventureStateFromLocalStorage,
  fallbackAdventureStorageKey,
  normalizeAdventureState,
  parseAdventureState,
  playNameFor,
  readAdventureIndex,
  saveAdventureStateToLocalStorage,
  type AdventureSummary,
  type GameplayState,
  type SavedAdventureState,
} from '@/lib/aigm/campaign-storage'

const DATABASE_NAME = 'rpgyw-aigm-campaigns'
const DATABASE_VERSION = 1
const ADVENTURE_STORE = 'adventures'
const MESSAGE_STORE = 'messages'
const CHARACTER_STORE = 'characters'
const ENTITY_STORE = 'entities'
const RETCON_STORE = 'retcons'

interface StoredAdventureCore {
  adventure_id: string
  updated_at: string
  state: Omit<SavedAdventureState, 'gameplay' | 'characters'> & {
    gameplay: Omit<GameplayState, 'messages' | 'transcript' | 'memory_index' | 'retcons'>
  }
  message_count: number
  character_count: number
  character_ids: string[]
  entity_count: number
  entity_ids: string[]
  retcon_count: number
  retcon_ids: string[]
  party_names: string[]
}

interface StoredMessage {
  storage_key: string
  adventure_id: string
  id: string
  role: 'user' | 'assistant'
  text: string
  created_at: string
  sequence: number
  turn_number: number | null
  exchange_id: string | null
}

type StoredCharacter = SavedAdventureState['characters'][number] & {
  storage_key: string
  adventure_id: string
}

type StoredEntity = SavedAdventureState['gameplay']['memory_index'][number] & {
  storage_key: string
  adventure_id: string
}

type StoredRetcon = SavedAdventureState['gameplay']['retcons'][number] & {
  storage_key: string
  adventure_id: string
}

export interface AdventureLoadResult {
  state: SavedAdventureState | null
  migrated: boolean
  storage: 'indexeddb' | 'localStorage' | 'none'
}

const saveQueues = new Map<string, Promise<void>>()
let databasePromise: Promise<IDBDatabase> | null = null
let persistenceRequestStarted = false

function indexedDbAvailable() {
  return typeof indexedDB !== 'undefined'
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'))
  })
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction was aborted.'))
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'))
  })
}

function openCampaignDatabase() {
  if (!indexedDbAvailable()) return Promise.reject(new Error('IndexedDB is not available in this browser.'))
  if (databasePromise) return databasePromise

  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(ADVENTURE_STORE)) {
        database.createObjectStore(ADVENTURE_STORE, { keyPath: 'adventure_id' })
      }
      if (!database.objectStoreNames.contains(MESSAGE_STORE)) {
        const store = database.createObjectStore(MESSAGE_STORE, { keyPath: 'storage_key' })
        store.createIndex('adventure_id', 'adventure_id', { unique: false })
      }
      if (!database.objectStoreNames.contains(CHARACTER_STORE)) {
        const store = database.createObjectStore(CHARACTER_STORE, { keyPath: 'storage_key' })
        store.createIndex('adventure_id', 'adventure_id', { unique: false })
      }
      if (!database.objectStoreNames.contains(ENTITY_STORE)) {
        const store = database.createObjectStore(ENTITY_STORE, { keyPath: 'storage_key' })
        store.createIndex('adventure_id', 'adventure_id', { unique: false })
      }
      if (!database.objectStoreNames.contains(RETCON_STORE)) {
        const store = database.createObjectStore(RETCON_STORE, { keyPath: 'storage_key' })
        store.createIndex('adventure_id', 'adventure_id', { unique: false })
      }
    }
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => {
        database.close()
        databasePromise = null
      }
      resolve(database)
    }
    request.onerror = () => {
      databasePromise = null
      reject(request.error ?? new Error('RPG Your Way could not open its local campaign database.'))
    }
    request.onblocked = () => {
      databasePromise = null
      reject(new Error('RPG Your Way campaign storage is blocked by another open page.'))
    }
  })

  return databasePromise
}

function messageStorageKey(adventureId: string, messageId: string) {
  return `${adventureId}:${messageId}`
}

function characterStorageKey(adventureId: string, characterId: string) {
  return `${adventureId}:${characterId}`
}

function entityStorageKey(adventureId: string, entityId: string) {
  return `${adventureId}:${entityId}`
}

function retconStorageKey(adventureId: string, retconId: string) {
  return `${adventureId}:${retconId}`
}

export function compactAdventureForStorage(state: SavedAdventureState): StoredAdventureCore {
  const {
    messages: _messages,
    transcript: _transcript,
    memory_index: _memoryIndex,
    retcons: _retcons,
    ...gameplayCore
  } = state.gameplay
  const { characters: _characters, gameplay: _gameplay, ...adventureCore } = state
  return {
    adventure_id: state.adventure_id,
    updated_at: state.updated_at,
    state: {
      ...adventureCore,
      gameplay: gameplayCore,
    },
    message_count: state.gameplay.transcript.length,
    character_count: state.characters.length,
    character_ids: state.characters.map((character) => character.id),
    entity_count: state.gameplay.memory_index.length,
    entity_ids: state.gameplay.memory_index.map((entry) => entry.id),
    retcon_count: state.gameplay.retcons.length,
    retcon_ids: state.gameplay.retcons.map((entry) => entry.id),
    party_names: state.characters.filter((character) => character.result).map((character) => playNameFor(character)),
  }
}

function changedCharacters(state: SavedAdventureState, previousState?: SavedAdventureState | null) {
  if (!previousState) return state.characters
  const previous = new Map(previousState.characters.map((character) => [character.id, character]))
  return state.characters.filter((character) => {
    const prior = previous.get(character.id)
    if (!prior) return true
    if (prior === character) return false
    return structuredFingerprint(prior) !== structuredFingerprint(character)
  })
}

function removedCharacterIds(state: SavedAdventureState, previousState?: SavedAdventureState | null) {
  if (!previousState) return []
  const active = new Set(state.characters.map((character) => character.id))
  return previousState.characters.map((character) => character.id).filter((id) => !active.has(id))
}

function changedEntities(state: SavedAdventureState, previousState?: SavedAdventureState | null) {
  if (!previousState) return state.gameplay.memory_index
  const previous = new Map(previousState.gameplay.memory_index.map((entry) => [entry.id, entry]))
  return state.gameplay.memory_index.filter((entry) => {
    const prior = previous.get(entry.id)
    if (!prior) return true
    return (entry.revision ?? 1) !== (prior.revision ?? 1)
      || entry.last_turn !== prior.last_turn
      || entry.title !== prior.title
      || entry.summary !== prior.summary
  })
}

function removedEntityIds(state: SavedAdventureState, previousState?: SavedAdventureState | null) {
  if (!previousState) return []
  const active = new Set(state.gameplay.memory_index.map((entry) => entry.id))
  return previousState.gameplay.memory_index.map((entry) => entry.id).filter((id) => !active.has(id))
}

function changedRetcons(state: SavedAdventureState, previousState?: SavedAdventureState | null) {
  if (!previousState) return state.gameplay.retcons
  const previous = new Map(previousState.gameplay.retcons.map((entry) => [entry.id, entry]))
  return state.gameplay.retcons.filter((entry) => {
    const prior = previous.get(entry.id)
    if (!prior) return true
    return (entry.revision ?? 1) !== (prior.revision ?? 1)
      || entry.turn !== prior.turn
      || entry.canonical_fact !== prior.canonical_fact
  })
}

function removedRetconIds(state: SavedAdventureState, previousState?: SavedAdventureState | null) {
  if (!previousState) return []
  const active = new Set(state.gameplay.retcons.map((entry) => entry.id))
  return previousState.gameplay.retcons.map((entry) => entry.id).filter((id) => !active.has(id))
}

function appendedMessages(state: SavedAdventureState, previousState?: SavedAdventureState | null) {
  if (!previousState || previousState.adventure_id !== state.adventure_id) return state.gameplay.transcript
  const previousSequence = previousState.gameplay.transcript.at(-1)?.sequence ?? 0
  return state.gameplay.transcript.filter((entry) => entry.sequence > previousSequence)
}

async function putAdventureIndexedDb(state: SavedAdventureState, previousState?: SavedAdventureState | null) {
  const database = await openCampaignDatabase()
  const transaction = database.transaction([ADVENTURE_STORE, MESSAGE_STORE, CHARACTER_STORE, ENTITY_STORE, RETCON_STORE], 'readwrite')
  const adventureStore = transaction.objectStore(ADVENTURE_STORE)
  const messageStore = transaction.objectStore(MESSAGE_STORE)
  const characterStore = transaction.objectStore(CHARACTER_STORE)
  const entityStore = transaction.objectStore(ENTITY_STORE)
  const retconStore = transaction.objectStore(RETCON_STORE)

  adventureStore.put(compactAdventureForStorage(state))

  for (const message of appendedMessages(state, previousState)) {
    const stored: StoredMessage = {
      storage_key: messageStorageKey(state.adventure_id, message.id),
      adventure_id: state.adventure_id,
      ...message,
    }
    messageStore.put(stored)
  }

  for (const character of changedCharacters(state, previousState)) {
    const stored: StoredCharacter = {
      storage_key: characterStorageKey(state.adventure_id, character.id),
      adventure_id: state.adventure_id,
      ...character,
    }
    characterStore.put(stored)
  }
  for (const id of removedCharacterIds(state, previousState)) characterStore.delete(characterStorageKey(state.adventure_id, id))

  for (const entity of changedEntities(state, previousState)) {
    const stored: StoredEntity = {
      storage_key: entityStorageKey(state.adventure_id, entity.id),
      adventure_id: state.adventure_id,
      ...entity,
    }
    entityStore.put(stored)
  }
  for (const id of removedEntityIds(state, previousState)) entityStore.delete(entityStorageKey(state.adventure_id, id))

  for (const retcon of changedRetcons(state, previousState)) {
    const stored: StoredRetcon = {
      storage_key: retconStorageKey(state.adventure_id, retcon.id),
      adventure_id: state.adventure_id,
      ...retcon,
    }
    retconStore.put(stored)
  }
  for (const id of removedRetconIds(state, previousState)) retconStore.delete(retconStorageKey(state.adventure_id, id))

  await transactionDone(transaction)
}

async function readAdventureIndexedDb(adventureId: string) {
  const database = await openCampaignDatabase()
  const transaction = database.transaction([ADVENTURE_STORE, MESSAGE_STORE, CHARACTER_STORE, ENTITY_STORE, RETCON_STORE], 'readonly')
  const coreRequest = transaction.objectStore(ADVENTURE_STORE).get(adventureId)
  const messageRequest = transaction.objectStore(MESSAGE_STORE).index('adventure_id').getAll(adventureId)
  const characterRequest = transaction.objectStore(CHARACTER_STORE).index('adventure_id').getAll(adventureId)
  const entityRequest = transaction.objectStore(ENTITY_STORE).index('adventure_id').getAll(adventureId)
  const retconRequest = transaction.objectStore(RETCON_STORE).index('adventure_id').getAll(adventureId)

  const [core, storedMessages, storedCharacters, storedEntities, storedRetcons] = await Promise.all([
    requestResult(coreRequest) as Promise<StoredAdventureCore | undefined>,
    requestResult(messageRequest) as Promise<StoredMessage[]>,
    requestResult(characterRequest) as Promise<StoredCharacter[]>,
    requestResult(entityRequest) as Promise<StoredEntity[]>,
    requestResult(retconRequest) as Promise<StoredRetcon[]>,
  ])
  await transactionDone(transaction)
  if (!core) return null

  const transcript = storedMessages
    .sort((left, right) => left.sequence - right.sequence)
    .map(({ storage_key: _storageKey, adventure_id: _adventureId, ...message }) => message)
  const characterById = new Map(storedCharacters.map(({ storage_key: _storageKey, adventure_id: _adventureId, ...character }) => [character.id, character] as const))
  const characters = core.character_ids.map((id) => characterById.get(id)).filter((character): character is SavedAdventureState['characters'][number] => Boolean(character))
  const entityById = new Map(storedEntities.map(({ storage_key: _storageKey, adventure_id: _adventureId, ...entry }) => [entry.id, entry] as const))
  const memoryIndex = core.entity_ids.map((id) => entityById.get(id)).filter((entry): entry is SavedAdventureState['gameplay']['memory_index'][number] => Boolean(entry))
  const retconById = new Map(storedRetcons.map(({ storage_key: _storageKey, adventure_id: _adventureId, ...entry }) => [entry.id, entry] as const))
  const retcons = core.retcon_ids.map((id) => retconById.get(id)).filter((entry): entry is SavedAdventureState['gameplay']['retcons'][number] => Boolean(entry))

  if (
    transcript.length !== core.message_count
    || characters.length !== core.character_count
    || memoryIndex.length !== core.entity_count
    || retcons.length !== core.retcon_count
  ) return null

  return normalizeAdventureState({
    ...core.state,
    characters,
    gameplay: {
      ...core.state.gameplay,
      messages: transcript.slice(-120),
      transcript,
      memory_index: memoryIndex,
      retcons,
    },
  })
}

function rollingHash(value: string, seed = 2166136261) {
  let hash = seed >>> 0
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return hash >>> 0
}

function transcriptFingerprint(state: SavedAdventureState) {
  let hash = 2166136261
  for (const message of state.gameplay.transcript) {
    hash = rollingHash(`${message.id}\u0000${message.role}\u0000${message.text}\u0000${message.created_at}\u0000${message.sequence}\u0000${message.turn_number ?? ''}\u0000${message.exchange_id ?? ''}`, hash)
  }
  return `${state.gameplay.transcript.length}:${hash.toString(16)}`
}

function structuredFingerprint(value: unknown) {
  return rollingHash(JSON.stringify(value)).toString(16)
}

function coreFingerprint(state: SavedAdventureState) {
  return structuredFingerprint(compactAdventureForStorage(state).state)
}

function characterFingerprint(state: SavedAdventureState) {
  return structuredFingerprint(state.characters)
}

function entityFingerprint(state: SavedAdventureState) {
  return structuredFingerprint(state.gameplay.memory_index)
}

function retconFingerprint(state: SavedAdventureState) {
  return structuredFingerprint(state.gameplay.retcons)
}

export function verifyAdventureIntegrity(expected: SavedAdventureState, actual: SavedAdventureState | null) {
  if (!actual) return false
  if (expected.adventure_id !== actual.adventure_id) return false
  if (expected.stage !== actual.stage) return false
  if (expected.gameplay.turn_count !== actual.gameplay.turn_count) return false
  if (expected.characters.length !== actual.characters.length) return false
  if (expected.gameplay.memory_index.length !== actual.gameplay.memory_index.length) return false
  if (expected.gameplay.retcons.length !== actual.gameplay.retcons.length) return false
  if (transcriptFingerprint(expected) !== transcriptFingerprint(actual)) return false
  if (coreFingerprint(expected) !== coreFingerprint(actual)) return false
  if (characterFingerprint(expected) !== characterFingerprint(actual)) return false
  if (entityFingerprint(expected) !== entityFingerprint(actual)) return false
  if (retconFingerprint(expected) !== retconFingerprint(actual)) return false
  for (let index = 0; index < expected.characters.length; index += 1) {
    const left = expected.characters[index]
    const right = actual.characters[index]
    if (!right || left.id !== right.id || left.playName !== right.playName || left.result?.character.name !== right.result?.character.name) return false
  }
  return true
}

function adventureSummary(state: SavedAdventureState): AdventureSummary {
  return {
    adventure_id: state.adventure_id,
    adventure_name: canonicalAdventureName(state.adventure_name),
    updated_at: state.updated_at,
    stage: state.stage,
    party_names: state.characters.filter((character) => character.result).map((character) => playNameFor(character)),
  }
}

function writeAdventureIndex(storage: Storage, state: SavedAdventureState) {
  const summary = adventureSummary(state)
  const index = readAdventureIndex(storage).filter((entry) => entry.adventure_id !== state.adventure_id)
  storage.setItem(ADVENTURE_INDEX_KEY, JSON.stringify([summary, ...index]))
  storage.setItem(CURRENT_ADVENTURE_KEY, state.adventure_id)
}

function requestPersistentStorage() {
  if (persistenceRequestStarted || typeof navigator === 'undefined' || !navigator.storage?.persist) return
  persistenceRequestStarted = true
  void navigator.storage.persist().catch(() => false)
}

function enqueueSave(adventureId: string, operation: () => Promise<void>) {
  const prior = saveQueues.get(adventureId) ?? Promise.resolve()
  const next = prior.catch(() => undefined).then(operation)
  saveQueues.set(adventureId, next)
  return next.finally(() => {
    if (saveQueues.get(adventureId) === next) saveQueues.delete(adventureId)
  })
}

/**
 * Save a campaign without rewriting the permanent transcript. IndexedDB is the
 * normal Build 4 path. A separate v2 localStorage fallback exists only for
 * browsers where IndexedDB is unavailable; it never overwrites a schema-1
 * rollback copy left by migration.
 */
export function saveAdventureState(storage: Storage, state: SavedAdventureState, previousState?: SavedAdventureState | null) {
  return enqueueSave(state.adventure_id, async () => {
    try {
      await putAdventureIndexedDb(state, previousState)
      writeAdventureIndex(storage, state)
      requestPersistentStorage()
    } catch (indexedDbError) {
      try {
        saveAdventureStateToLocalStorage(storage, state, true)
      } catch {
        throw indexedDbError
      }
    }
  })
}

async function migrateLocalAdventure(storage: Storage, state: SavedAdventureState) {
  await putAdventureIndexedDb(state, null)
  const verified = await readAdventureIndexedDb(state.adventure_id)
  if (!verifyAdventureIntegrity(state, verified)) {
    await deleteAdventureIndexedDb(state.adventure_id).catch(() => undefined)
    throw new Error('The local campaign migration did not verify.')
  }
  storage.setItem(`${ADVENTURE_MIGRATION_PREFIX}${state.adventure_id}`, JSON.stringify({
    storage_schema: 2,
    migrated_at: new Date().toISOString(),
    legacy_copy_retained: Boolean(storage.getItem(adventureStorageKey(state.adventure_id))),
  }))
  writeAdventureIndex(storage, verified!)
  requestPersistentStorage()
  return verified!
}

function compareAdventureFreshness(left: SavedAdventureState, right: SavedAdventureState) {
  const transcriptDifference = left.gameplay.transcript.length - right.gameplay.transcript.length
  if (transcriptDifference !== 0) return transcriptDifference
  const turnDifference = left.gameplay.turn_count - right.gameplay.turn_count
  if (turnDifference !== 0) return turnDifference
  return left.updated_at.localeCompare(right.updated_at)
}

function newerState(...states: Array<SavedAdventureState | null>) {
  return states
    .filter((state): state is SavedAdventureState => Boolean(state))
    .sort((left, right) => compareAdventureFreshness(right, left))[0] ?? null
}

export async function loadAdventureState(storage: Storage, adventureId: string): Promise<AdventureLoadResult> {
  if (!adventureId) return { state: null, migrated: false, storage: 'none' }

  const fallback = parseAdventureState(storage.getItem(fallbackAdventureStorageKey(adventureId)))
  const legacy = parseAdventureState(storage.getItem(adventureStorageKey(adventureId)))
  let indexed: SavedAdventureState | null = null

  if (indexedDbAvailable()) {
    try {
      indexed = await readAdventureIndexedDb(adventureId)
    } catch {
      // A legacy or fallback copy can still keep the campaign playable.
    }
  }

  // A fallback can be newer than IndexedDB if a prior write fell back after a
  // transient database failure. Likewise, a retained schema-1 copy can be
  // newer if the user temporarily returned to a pre-4.0 build. Always recover
  // the newest intact representation instead of silently discarding play.
  const localCandidate = newerState(fallback, legacy)
  if (localCandidate && (!indexed || compareAdventureFreshness(localCandidate, indexed) > 0)) {
    if (indexedDbAvailable()) {
      try {
        const migrated = await migrateLocalAdventure(storage, localCandidate)
        if (fallback && fallback.updated_at <= migrated.updated_at) storage.removeItem(fallbackAdventureStorageKey(adventureId))
        return { state: migrated, migrated: true, storage: 'indexeddb' }
      } catch {
        // The local source remains untouched and playable.
      }
    }
    return { state: localCandidate, migrated: false, storage: 'localStorage' }
  }

  if (indexed) {
    writeAdventureIndex(storage, indexed)
    if (fallback && fallback.updated_at <= indexed.updated_at) storage.removeItem(fallbackAdventureStorageKey(adventureId))
    return { state: indexed, migrated: false, storage: 'indexeddb' }
  }

  if (!localCandidate) return { state: null, migrated: false, storage: 'none' }
  return { state: localCandidate, migrated: false, storage: 'localStorage' }
}

async function keysForAdventure(database: IDBDatabase, storeName: string, adventureId: string) {
  const transaction = database.transaction(storeName, 'readonly')
  const keys = await requestResult(transaction.objectStore(storeName).index('adventure_id').getAllKeys(adventureId))
  await transactionDone(transaction)
  return keys
}

async function deleteAdventureIndexedDb(adventureId: string) {
  if (!indexedDbAvailable()) return
  const database = await openCampaignDatabase()
  const [messageKeys, characterKeys, entityKeys, retconKeys] = await Promise.all([
    keysForAdventure(database, MESSAGE_STORE, adventureId),
    keysForAdventure(database, CHARACTER_STORE, adventureId),
    keysForAdventure(database, ENTITY_STORE, adventureId),
    keysForAdventure(database, RETCON_STORE, adventureId),
  ])
  const transaction = database.transaction([ADVENTURE_STORE, MESSAGE_STORE, CHARACTER_STORE, ENTITY_STORE, RETCON_STORE], 'readwrite')
  transaction.objectStore(ADVENTURE_STORE).delete(adventureId)
  const messageStore = transaction.objectStore(MESSAGE_STORE)
  const characterStore = transaction.objectStore(CHARACTER_STORE)
  const entityStore = transaction.objectStore(ENTITY_STORE)
  const retconStore = transaction.objectStore(RETCON_STORE)
  for (const key of messageKeys) messageStore.delete(key)
  for (const key of characterKeys) characterStore.delete(key)
  for (const key of entityKeys) entityStore.delete(key)
  for (const key of retconKeys) retconStore.delete(key)
  await transactionDone(transaction)
}

export async function deleteAdventureState(storage: Storage, adventureId: string) {
  await deleteAdventureIndexedDb(adventureId).catch(() => undefined)
  deleteAdventureStateFromLocalStorage(storage, adventureId)
}

export async function readAdventureIndexWithDatabase(storage: Storage) {
  const summaries = new Map(readAdventureIndex(storage).map((entry) => [entry.adventure_id, entry]))
  if (indexedDbAvailable()) {
    try {
      const database = await openCampaignDatabase()
      const transaction = database.transaction(ADVENTURE_STORE, 'readonly')
      const cores = await requestResult(transaction.objectStore(ADVENTURE_STORE).getAll()) as StoredAdventureCore[]
      await transactionDone(transaction)
      for (const core of cores) {
        summaries.set(core.adventure_id, {
          adventure_id: core.adventure_id,
          adventure_name: canonicalAdventureName(core.state.adventure_name),
          updated_at: core.updated_at,
          stage: core.state.stage,
          party_names: core.party_names ?? [],
        })
      }
    } catch {
      // The small local index remains a useful fallback.
    }
  }
  return [...summaries.values()].sort((left, right) => right.updated_at.localeCompare(left.updated_at))
}

export async function flushAdventureSaves(adventureId: string) {
  await (saveQueues.get(adventureId) ?? Promise.resolve()).catch(() => undefined)
}
