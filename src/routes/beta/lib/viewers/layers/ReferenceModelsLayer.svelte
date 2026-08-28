<script lang="ts">
  import { referenceModels, transformMode, clickedKey } from '$lib/store'
  import ImportedModel from '$lib/3d/ImportedModel.svelte'

  export let importedOpacity: number = 1
  export let selectedImportId: number | null = null
  export let hoveredImportId: number | null = null
</script>

{#each $referenceModels as model (model.id)}
  <ImportedModel
    geometry={model.geometry}
    matrix={model.matrix}
    opacity={importedOpacity}
    selected={selectedImportId == model.id}
    hovered={hoveredImportId == model.id}
    mode={$transformMode}
    on:select={() => {
      selectedImportId = model.id
      $clickedKey = null
    }}
    on:deselect={() => (selectedImportId = null)}
    on:hover={() => (hoveredImportId = model.id)}
    on:unhover={() => (hoveredImportId = null)}
    on:change={(e) => {
      model.matrix = e.detail
      referenceModels.update((r) => r)
    }}
  />
{/each}
