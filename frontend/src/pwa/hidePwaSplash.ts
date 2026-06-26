/** Remove a splash estática (#pwa-splash) após o React montar a primeira frame. */
export function hidePwaSplash(): void {
  const el = document.getElementById('pwa-splash');
  if (!el) return;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.classList.add('pwa-splash--hide');
      const remove = () => el.remove();
      el.addEventListener('transitionend', remove, { once: true });
      window.setTimeout(remove, 400);
    });
  });
}
