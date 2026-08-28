<script lang="ts">
  import { debugViewport } from '$lib/store'
  import { Vector3 } from 'three'

  export let cameraPosition: [number, number, number] = [0.16, -0.96, 0.56]

  function copyCanvas() {
    document.querySelector('canvas')?.toBlob((blob) => {
      if (!blob) return
      const item = new ClipboardItem({ 'image/png': blob })
      navigator.clipboard.write([item]).then(console.log, console.error)
    })
  }
</script>

{#if $debugViewport}
  <div
    class="absolute bottom-8 right-8 bg-gray-100/80 dark:bg-gray-800/80 backdrop-blur-md rounded px-4 py-2 text-xs font-mono w-76 text-end select-none"
  >
    <p>
      Camera Position: {new Vector3(...cameraPosition)
        .normalize()
        .toArray()
        .map((a) => Math.round(a * 100) / 100)
        .join(', ')}
    </p>
    <p><button class="inline-block!" on:click={copyCanvas}>Copy Canvas to clipboard</button></p>
  </div>
{/if}
