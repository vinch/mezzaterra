<script lang="ts">
  import { IconInstagram, IconMail } from "$lib/ui/icons";
  import { page } from "$app/stores";

  let onContact = $derived($page.url.pathname === "/contact");
</script>

<footer class="site-footer">
  <a
    href="/contact"
    class="footer-link"
    class:active={onContact}
    aria-current={onContact ? "page" : undefined}
  >
    <IconMail class="footer-icon" strokeWidth={1.8} aria-hidden="true" />
    <span>Contact</span>
  </a>
  <a
    href="https://instagram.com/wearemztr"
    target="_blank"
    rel="noopener noreferrer"
    class="footer-link"
    aria-label="Instagram Mezzaterra"
  >
    <IconInstagram class="footer-icon" aria-hidden="true" />
    <span>Instagram</span>
  </a>
</footer>

<style>
  .site-footer {
    padding: 1.5rem 1.25rem 2rem;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
  }

  .footer-link {
    display: inline-flex;
    align-items: center;
    gap: 0.65rem;
    color: var(--mz-teal);
    text-decoration: none;
    font-weight: 600;
    padding: 0.75rem 1rem;
    border-radius: 999px;
    transition:
      transform 0.2s ease,
      background-color 0.2s ease,
      color 0.2s ease;
  }

  .footer-link:hover {
    background-color: var(--mz-teal-wash);
    transform: translateY(-1px);
  }

  .footer-link.active {
    background-color: var(--mz-teal-wash);
  }

  .footer-link :global(.footer-icon) {
    width: 1.25rem;
    height: 1.25rem;
    flex-shrink: 0;
  }

  @media (max-width: 640px) {
    .site-footer {
      padding: 0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom));
    }
  }
</style>
