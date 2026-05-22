import TrackingClient from './tracking-client';

export default async function PublicOrderTrackingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return <TrackingClient token={token} />;
}
