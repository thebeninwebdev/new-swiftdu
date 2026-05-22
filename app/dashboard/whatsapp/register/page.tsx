'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, MessageCircle, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { authClient } from '@/lib/auth-client';

type RegistrationStatus = 'pending' | 'linked';

type RegistrationResponse = {
  phone?: string;
  status?: RegistrationStatus;
  error?: string;
};

function WhatsAppRegistrationContent() {
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const [registration, setRegistration] = useState<RegistrationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    if (!token) {
      setRegistration({ error: 'This WhatsApp registration link is missing its token.' });
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadRegistration() {
      setLoading(true);
      try {
        const response = await fetch(`/api/whatsapp/registrations?token=${encodeURIComponent(token)}`);
        const data = (await response.json()) as RegistrationResponse;

        if (!cancelled) {
          setRegistration(response.ok ? data : { error: data.error || 'Invalid registration link.' });
        }
      } catch {
        if (!cancelled) {
          setRegistration({ error: 'Could not load this WhatsApp registration link.' });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadRegistration();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleLink = async () => {
    if (!token) return;

    setLinking(true);
    try {
      const response = await fetch('/api/whatsapp/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = (await response.json()) as RegistrationResponse;

      if (!response.ok) {
        toast.error(data.error || 'Could not link WhatsApp.');
        setRegistration((previous) => ({ ...previous, error: data.error }));
        return;
      }

      setRegistration(data);
      toast.success('WhatsApp bot linked to your SwiftDU account.');
    } catch {
      toast.error('Could not link WhatsApp right now.');
    } finally {
      setLinking(false);
    }
  };

  const isLinked = registration?.status === 'linked';
  const error = registration?.error;

  return (
    <main className="min-h-screen bg-background px-4 py-8 md:py-14">
      <div className="mx-auto max-w-xl">
        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardHeader className="space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <MessageCircle className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl font-bold">Link WhatsApp Bot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {loading ? (
              <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking your registration link...
              </div>
            ) : error ? (
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
                <ShieldAlert className="mt-0.5 h-4 w-4" />
                <span>{error}</span>
              </div>
            ) : isLinked ? (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
                <CheckCircle2 className="mt-0.5 h-4 w-4" />
                <span>This WhatsApp number is linked. Return to WhatsApp and reply MENU.</span>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm">
                  WhatsApp number: <span className="font-semibold">{registration?.phone}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  You must be logged in to your SwiftDU website account before linking this WhatsApp bot.
                </p>
                {session?.user ? (
                  <Button onClick={handleLink} disabled={linking} size="lg" className="w-full">
                    {linking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Link WhatsApp to my account
                  </Button>
                ) : sessionLoading ? (
                  <Button disabled size="lg" className="w-full">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking login...
                  </Button>
                ) : (
                  <Link
                    href={`/login?callbackUrl=${encodeURIComponent(`/dashboard/whatsapp/register?token=${token}`)}`}
                    className={buttonVariants({ size: 'lg', className: 'w-full' })}
                  >
                    Log in to SwiftDU first
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function WhatsAppRegistrationPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background px-4 py-8 md:py-14">
          <div className="mx-auto max-w-xl rounded-2xl border border-border p-6 text-sm text-muted-foreground">
            Loading WhatsApp registration...
          </div>
        </main>
      }
    >
      <WhatsAppRegistrationContent />
    </Suspense>
  );
}
