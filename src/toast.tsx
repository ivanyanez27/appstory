type Props = { message: string | null };

export function AgentToast({ message }: Props) {
  if (!message) return null;
  return <div className="lsw-toast">{message}</div>;
}
