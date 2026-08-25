'use client'

import { type RefObject, useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'details > summary:first-of-type',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',')

interface HiddenSiblingRecord {
  element: HTMLElement
  ariaHidden: string | null
  inert: boolean
}

interface AccessibleDialogOptions {
  open: boolean
  onClose: () => void
  initialFocusRef?: RefObject<HTMLElement | null>
  closeOnEscape?: boolean
  restoreFocus?: boolean
}

function focusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    if (element.hidden || element.getAttribute('aria-hidden') === 'true') return false
    const style = window.getComputedStyle(element)
    return style.visibility !== 'hidden' && style.display !== 'none' && element.getClientRects().length > 0
  })
}

function makeOutsideContentInert(dialog: HTMLElement) {
  const records: HiddenSiblingRecord[] = []
  let branch: HTMLElement | null = dialog

  while (branch && branch !== document.body) {
    const parent: HTMLElement | null = branch.parentElement
    if (!parent) break
    for (const sibling of Array.from(parent.children)) {
      if (!(sibling instanceof HTMLElement) || sibling === branch) continue
      records.push({
        element: sibling,
        ariaHidden: sibling.getAttribute('aria-hidden'),
        inert: sibling.hasAttribute('inert'),
      })
      sibling.setAttribute('aria-hidden', 'true')
      sibling.setAttribute('inert', '')
    }
    branch = parent
  }

  return () => {
    for (const record of records) {
      if (record.ariaHidden === null) record.element.removeAttribute('aria-hidden')
      else record.element.setAttribute('aria-hidden', record.ariaHidden)
      if (!record.inert) record.element.removeAttribute('inert')
    }
  }
}

export function useAccessibleDialog<T extends HTMLElement = HTMLElement>({
  open,
  onClose,
  initialFocusRef,
  closeOnEscape = true,
  restoreFocus = true,
}: AccessibleDialogOptions) {
  const dialogRef = useRef<T | null>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    if (!dialog) return
    const dialogElement: HTMLElement = dialog

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const restoreOutsideContent = makeOutsideContentInert(dialogElement)

    const frame = window.requestAnimationFrame(() => {
      const target = initialFocusRef?.current || focusableElements(dialogElement)[0] || dialogElement
      target.focus()
    })

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && closeOnEscape) {
        event.preventDefault()
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = focusableElements(dialogElement)
      if (focusable.length === 0) {
        event.preventDefault()
        dialogElement.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || !dialogElement.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !dialogElement.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', handleKeyDown, true)
      restoreOutsideContent()
      document.body.style.overflow = previousOverflow
      if (restoreFocus && previouslyFocused?.isConnected) {
        window.requestAnimationFrame(() => previouslyFocused.focus())
      }
    }
  }, [closeOnEscape, initialFocusRef, open, restoreFocus])

  return dialogRef
}
