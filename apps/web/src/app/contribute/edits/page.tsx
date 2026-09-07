import { redirect } from 'next/navigation';

/** Edits history lives under Account now. */
export default function ContributeEditsRedirect() {
  redirect('/account/edits');
}
