'use client'

import { useRef } from 'react'

export function PersistentPlayModal() {
  const dialogRef = useRef<HTMLDialogElement>(null)

  function openDialog() {
    dialogRef.current?.showModal()
  }

  function closeDialog() {
    dialogRef.current?.close()
  }

  return (
    <>
      <button className="persistent-play-trigger" type="button" onClick={openDialog}>
        Persistent Campaign?
      </button>

      <dialog
        className="persistent-play-dialog"
        ref={dialogRef}
        aria-labelledby="persistent-play-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDialog()
        }}
      >
        <article className="persistent-play-modal-card">
          <header className="persistent-play-modal-header">
            <h2 id="persistent-play-title">Okay. So what the hell do we mean by persistent play?</h2>
            <button className="persistent-play-close-x" type="button" onClick={closeDialog} aria-label="Close persistent play explanation">
              ×
            </button>
          </header>

          <div className="persistent-play-modal-copy">
            <p>AI is a lot like a human DM in one important way: it cannot keep every detail of a long campaign at the front of its mind all the time.</p>

            <p>Recent events, the people you have been dealing with, and what is happening right now are going to be much more immediate.</p>

            <p>But the older things are not gone.</p>

            <p>Your AIGM has recall of what has happened throughout the campaign, all the way back to the beginning.</p>

            <p>So if, three hundred turns later, you suddenly need the name of the conductor on the train that brought you into the first city you visited, the AIGM may not immediately remember it. It may even tell you that it doesn’t quite remember.</p>

            <p>Fine.</p>

            <p>Tell it to look it up.</p>

            <p>The fact is still there, and it can go back and find it.</p>

            <p>That is what we mean by persistent play. Your campaign does not gradually evaporate behind you as you keep playing. What happened before remains part of the game and can matter again later.</p>

            <p>Now, that does <strong>not</strong> mean the AI is perfect, or that every fact it knows will be used correctly every single time.</p>

            <p>I have a character in one of my own campaigns who is effectively a robot. Robots don’t eat. The AIGM remembers the character’s abilities, skills, modifiers, equipment, and all kinds of much more complicated things.</p>

            <p>Then every once in a while it says, “Okay, you bought six servings of food.”</p>

            <p>And I have to say, “Five. The robot doesn’t eat.”</p>

            <p>That’s AI.</p>

            <p>If you expect your AIGM to be perfect, you are going to be disappointed. If you expect to work with it, remind it when it misses something, correct it when necessary, and treat it as a partner in the game rather than an opponent you are trying to catch making a mistake, you will have a much better time.</p>

            <p>I say this elsewhere on the site, and I mean it:</p>

            <p className="persistent-play-thesis"><strong>Work with your AI, not against it.</strong></p>

            <p>Persistent play means the campaign keeps building on itself. The things you did a long time ago are still there, and when they come back around, your AIGM can remember them.</p>
          </div>

          <footer className="persistent-play-modal-footer">
            <button type="button" onClick={closeDialog}>Close</button>
          </footer>
        </article>
      </dialog>
    </>
  )
}
