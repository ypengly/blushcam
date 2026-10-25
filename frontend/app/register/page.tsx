import { Suspense } from 'react';
import { AuthForm } from '../../features/auth/AuthForm.tsx';
export const metadata = { title: 'Create account' };
export default function Page() { return <Suspense><AuthForm mode="register" /></Suspense>; }
