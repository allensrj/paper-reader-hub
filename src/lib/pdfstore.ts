const DB_NAME = 'paper-board-files'
const STORE = 'pdf'
/** 全文翻译的成品：一篇存一条，翻过一次以后每次点「全文翻译」都是秒开 */
const TR_STORE = 'doctr'
const VERSION = 2

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
      if (!db.objectStoreNames.contains(TR_STORE)) db.createObjectStore(TR_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function putPdf(id: string, data: ArrayBuffer): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(data, id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function getPdf(id: string): Promise<ArrayBuffer | null> {
  const db = await openDb()
  const result = await new Promise<ArrayBuffer | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(id)
    req.onsuccess = () => resolve((req.result as ArrayBuffer) || null)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return result
}

export async function putDocTr(id: string, value: unknown): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(TR_STORE, 'readwrite')
    tx.objectStore(TR_STORE).put(value, id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function getDocTr<T>(id: string): Promise<T | null> {
  const db = await openDb()
  const result = await new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(TR_STORE, 'readonly')
    const req = tx.objectStore(TR_STORE).get(id)
    req.onsuccess = () => resolve((req.result as T) || null)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return result
}

export async function delDocTr(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(TR_STORE, 'readwrite')
    tx.objectStore(TR_STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function delPdf(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}
