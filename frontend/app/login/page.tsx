import { Suspense } from 'react';
import { AuthForm } from '../../features/auth/AuthForm.tsx';
export const metadata = { title: 'Sign in' };
export default function Page() { return <Suspense><AuthForm mode="login" /></Suspense>; }
