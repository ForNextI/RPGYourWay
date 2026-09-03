import Link from 'next/link'

export function ShapeSignInGate() {
  return (
    <section className="shape-gate" aria-labelledby="shape-sign-in-title">
      <p className="kicker">Account required</p>
      <h2 id="shape-sign-in-title">Sign in before you hand Script a campaign.</h2>
      <p>Your Script jobs belong to your account so a long conversion can survive a refresh, a closed tab, or a temporary processing failure.</p>
      <Link className="button button-primary" href="/account#sign-in">Go to Account</Link>
    </section>
  )
}
