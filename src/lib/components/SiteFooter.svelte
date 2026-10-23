<script lang="ts">
  import IconMail from "@lucide/svelte/icons/mail";
</script>

<footer class="site-footer">
  <a href="/contact" class="footer-link">
    <IconMail class="footer-icon" size={20} strokeWidth={1.8} aria-hidden="true" />
    <span>Contact</span>
  </a>
  <a
    href="https://instagram.com/wearemztr"
    target="_blank"
    rel="noopener noreferrer"
    class="footer-link"
    aria-label="Instagram Mezzaterra"
  >
    <svg viewBox="0 0 24 24" aria-hidden="true" class="footer-icon">
      <path
        d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2Zm0 1.8A3.7 3.7 0 0 0 3.8 7.5v9a3.7 3.7 0 0 0 3.7 3.7h9a3.7 3.7 0 0 0 3.7-3.7v-9a3.7 3.7 0 0 0-3.7-3.7h-9Zm9.55 1.35a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2ZM12 6.8A5.2 5.2 0 1 1 6.8 12 5.2 5.2 0 0 1 12 6.8Zm0 1.8A3.4 3.4 0 1 0 15.4 12 3.4 3.4 0 0 0 12 8.6Z"
      />
    </svg>
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
    color: var(--mz-teal, #256169);
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
    background-color: var(--mz-teal-wash, rgba(37, 97, 105, 0.08));
    transform: translateY(-1px);
  }

  svg.footer-icon {
    width: 1.25rem;
    height: 1.25rem;
    fill: currentColor;
    flex-shrink: 0;
  }

  .footer-link :global(.footer-icon) {
    flex-shrink: 0;
  }

  @media (max-width: 640px) {
    .site-footer {
      padding: 0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom));
    }
  }
</style>
