export function AuthError({ message, id }: { message?: string; id?: string }) {
  return (
    <p id={id} aria-live="polite" aria-atomic="true" className={message ? "text-sm text-danger-text" : "sr-only"}>
      {message}
    </p>
  );
}
