<script lang="ts">
  import { referenceModels, clickedKey } from '$lib/store'
  import * as mdi from '@mdi/js'
  import Icon from '$lib/presentation/Icon.svelte'

  export let importedOpacity: number = 1
  export let selectedImportId: number | null = null
  export let hoveredImportId: number | null = null

  function deleteImport(id: number) {
    referenceModels.update((r) => r.filter((m) => m.id != id))
    if (selectedImportId == id) selectedImportId = null
    if (hoveredImportId == id) hoveredImportId = null
  }
</script>

{#if $referenceModels.length > 0}
  <div class="absolute! bottom-10 left-4 z-20 select-none tab overflow-hidden">
    <div class="tabhead gap-4 py-1!">
      Imported Models
      <input type="range" class="w-30" min="0" max="1" step="0.01" bind:value={importedOpacity} />
    </div>
    <div class="px-3 py-2">
      <ul class="flex flex-col gap-0.5">
        {#each $referenceModels as model (model.id)}
          <li
            class="flex items-center gap-1 rounded px-1"
            class:bg-purple-200={selectedImportId == model.id}
            class:dark:bg-pink-900={selectedImportId == model.id}
            class:bg-purple-100={hoveredImportId == model.id && selectedImportId != model.id}
            class:dark:bg-pink-950={hoveredImportId == model.id && selectedImportId != model.id}
            on:mouseenter={() => (hoveredImportId = model.id)}
            on:mouseleave={() => (hoveredImportId = null)}
          >
            <button
              class="flex-1 text-left text-sm truncate py-1"
              title={model.name}
              on:click={() => {
                selectedImportId = model.id
                $clickedKey = null
              }}>{model.name}</button
            >
            <button
              class="bg-purple-200 hover:bg-purple-300 dark:bg-pink-600 hover:dark:bg-pink-600 appearance-none p-1 rounded-full text-gray-800 dark:text-gray-200"
              title="Delete"
              on:click|stopPropagation={() => {
                deleteImport(model.id)
              }}
            >
              <Icon size="18px" path={mdi.mdiDelete} />
            </button>
          </li>
        {/each}
      </ul>
    </div>
  </div>
{/if}

<style>
  .tab {
    --at-apply: 'bg-[#f8f5ff]/80 backdrop-blur-md dark:bg-slate-900/80 rounded-2 overflow-hidden mb-4 transition-opacity relative z-10';
  }
  .tabhead {
    --at-apply: 'bg-purple-300 dark:bg-pink-600 px-3 py-0.5 flex justify-between';
  }
  input[type='range'] {
    --at-apply: 'appearance-none bg-transparent';
  }

  input[type='range']::-moz-range-track {
    --at-apply: 'appearance-none bg-[#EFE8FF]/70 dark:bg-slate-900/50 h-2 rounded';
  }

  input[type='range']::-webkit-slider-runnable-track {
    --at-apply: 'appearance-none bg-[#EFE8FF]/70 dark:bg-slate-900/50 h-2 rounded';
  }

  input[type='range']::-moz-range-thumb {
    --at-apply: "appearance-none w-4.5 h-4.5 bg-white dark:bg-pink-200 rounded-full border-transparent bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggb3BhY2l0eT0iMC43IiBkPSJNMTIsMThWNkE2LDYgMCAwLDEgMTgsMTJBNiw2IDAgMCwxIDEyLDE4TTIwLDE1LjMxTDIzLjMxLDEyTDIwLDguNjlWNEgxNS4zMUwxMiwwLjY5TDguNjksNEg0VjguNjlMMC42OSwxMkw0LDE1LjMxVjIwSDguNjlMMTIsMjMuMzFMMTUuMzEsMjBIMjBWMTUuMzFaIiAvPjwvc3ZnPg==')]";
    background-size: 1rem 1rem;
    background-position: center 40%;
    background-repeat: no-repeat;
  }

  input[type='range']::-webkit-slider-thumb {
    --at-apply: "appearance-none w-5.3 h-5.3 bg-white dark:bg-pink-200 rounded-full border-transparent mt--2.4 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggb3BhY2l0eT0iMC43IiBkPSJNMTIsMThWNkE2LDYgMCAwLDEgMTgsMTJBNiw2IDAgMCwxIDEyLDE4TTIwLDE1LjMxTDIzLjMxLDEyTDIwLDguNjlWNEgxNS4zMUwxMiwwLjY5TDguNjksNEg0VjguNjlMMC42OSwxMkw0LDE1LjMxVjIwSDguNjlMMTIsMjMuMzFMMTUuMzEsMjBIMjBWMTUuMzFaIiAvPjwvc3ZnPg==')]";
    background-size: 1rem 1rem;
    background-position: center 40%;
    background-repeat: no-repeat;
  }

  input[type='range']::-moz-range-thumb:hover {
    --at-apply: 'bg-teal-200 dark:bg-white';
  }
  input[type='range']::-webkit-slider-thumb:hover {
    --at-apply: 'bg-teal-200 dark:bg-white';
  }
</style>
