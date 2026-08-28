<script lang="ts">
  import { showHelp } from '$lib/store'
  import * as mdi from '@mdi/js'
  import Icon from '$lib/presentation/Icon.svelte'
  import { fade } from 'svelte/transition'
</script>

{#if $showHelp}
  <div
    class="bg-white/80 dark:bg-gray-800/80 absolute inset-0 z-5 flex items-center justify-center font-urbanist font-500 backdrop-blur-3 max-[528px]:hidden"
    transition:fade
  >
    <div class="text-center">
      <button class="button purple inline-block!" on:click={() => ($showHelp = false)}>Close Help</button
      >
      <div class="font-urbanist text-xs w-40 light:opacity-80">
        You can access this help from the <Icon
          class="inline-block relative top--0.5"
          size="16"
          path={mdi.mdiCogOutline}
        /> menu.<br />
        Also:
        <a href="docs/tips-and-tricks/" target="_blank" class="text-teal-500 dark:text-teal-300"
          >tips &amp; tricks</a
        >.
      </div>
    </div>
  </div>
{/if}

<style>
  .button {
    z-index: 10;
    --at-apply: 'appearance-none bg-gray-200 dark:bg-gray-900 p-1 pr-2 m-1 rounded text-gray-800 dark:text-gray-200 flex gap-2';
  }
  .button:not(:disabled) {
    --at-apply: 'hover:bg-gray-400 dark:hover:bg-gray-700';
  }
  .button:disabled {
    --at-apply: 'opacity-40';
  }

  .purple.purple {
    --at-apply: 'px-2 bg-purple-300 dark:bg-gray-900 hover:bg-purple-400 dark:hover:bg-pink-900 focus:border-pink-500';
  }

  .font-urbanist .text-xs {
    font-size: 0.8rem;
  }
</style>
