import Image from 'next/image';
import { RegistrationForm } from '@/components/registration-form';

export default function RegistroPublico() {
  return <main className="min-h-screen px-4 py-8 sm:py-12"><div className="max-w-2xl mx-auto space-y-8">
    <header className="text-center space-y-3"><Image src="/logo.png" alt="Valle Grande FC" width={80} height={80} className="mx-auto object-contain h-auto" /><h1 className="text-3xl font-bold">Inscripción Valle Grande FC</h1><p className="text-slate-400">Completa tus datos, adjunta tus documentos y firma tu autorización para la liga.</p></header>
    <RegistrationForm />
  </div></main>;
}
