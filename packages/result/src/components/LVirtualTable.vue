<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'

interface ColumnDef {
  key: string
  title: string
  width: number
  visible: boolean
}

const props = defineProps<{
  columns: string[]
  rows: unknown[][]
}>()

const emit = defineEmits<{
  (e: 'cell-edit', row: number, col: number, value: unknown): void
}>()

const columnDefs = ref<ColumnDef[]>([])
const sortKey = ref<string | null>(null)
const sortDir = ref<'asc' | 'desc'>('asc')
const filterText = ref<Record<string, string>>({})
const editingCell = ref<{ row: number; col: number } | null>(null)
const editValue = ref('')
const modifiedRows = ref<Set<number>>(new Set())
const selectedRows = ref<Set<number>>(new Set())
const scrollContainer = ref<HTMLElement>()

watch(() => props.columns, (cols) => {
  columnDefs.value = cols.map((c) => ({
    key: c,
    title: c,
    width: 150,
    visible: true,
  }))
}, { immediate: true })

const processedRows = computed(() => {
  let rows = props.rows.map((r, i) => ({ index: i, data: r }))
  for (const [col, text] of Object.entries(filterText.value)) {
    if (!text) continue
    const q = text.toLowerCase()
    const colIdx = columnDefs.value.findIndex((c) => c.key === col)
    if (colIdx >= 0) {
      rows = rows.filter((r) => String(r.data[colIdx] ?? '').toLowerCase().includes(q))
    }
  }
  if (sortKey.value) {
    const colIdx = columnDefs.value.findIndex((c) => c.key === sortKey.value)
    if (colIdx >= 0) {
      rows = [...rows].sort((a, b) => {
        const va = a.data[colIdx] ?? ''
        const vb = b.data[colIdx] ?? ''
        if (va === vb) return 0
        const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true })
        return sortDir.value === 'asc' ? cmp : -cmp
      })
    }
  }
  return rows
})

const virtualizer = useVirtualizer(
  computed(() => ({
    count: processedRows.value.length,
    getScrollElement: () => scrollContainer.value ?? null,
    estimateSize: () => 28,
    overscan: 10,
  }))
)

function toggleSort(key: string) {
  if (sortKey.value === key) {
    if (sortDir.value === 'asc') { sortDir.value = 'desc' }
    else if (sortDir.value === 'desc') { sortKey.value = null }
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}

function sortIcon(key: string): string {
  if (sortKey.value !== key) return ''
  return sortDir.value === 'asc' ? ' ▲' : ' ▼'
}

function displayValue(val: unknown): string {
  if (val === null || val === undefined) return '(NULL)'
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

function isNull(val: unknown): boolean {
  return val === null || val === undefined
}

const resizing = ref<string | null>(null)
let resizeStartX = 0
let resizeStartW = 0

function startResize(e: MouseEvent, key: string) {
  resizing.value = key
  resizeStartX = e.clientX
  const col = columnDefs.value.find((c) => c.key === key)
  resizeStartW = col?.width ?? 150
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
}

function onResize(e: MouseEvent) {
  if (!resizing.value) return
  const delta = e.clientX - resizeStartX
  const col = columnDefs.value.find((c) => c.key === resizing.value!)
  if (col) col.width = Math.max(60, resizeStartW + delta)
}

function stopResize() {
  resizing.value = null
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
}

function startEdit(rowIdx: number, colIdx: number) {
  editingCell.value = { row: rowIdx, col: colIdx }
  const row = processedRows.value[rowIdx]
  editValue.value = row ? String(row.data[colIdx] ?? '') : ''
}

function confirmEdit() {
  if (!editingCell.value) return
  const { row, col } = editingCell.value
  const actualRow = processedRows.value[row]?.index
  if (actualRow !== undefined) {
    modifiedRows.value.add(actualRow)
    emit('cell-edit', actualRow, col, editValue.value)
  }
  editingCell.value = null
}

function toggleRow(e: MouseEvent, rowIdx: number) {
  const actualIdx = processedRows.value[rowIdx]?.index
  if (actualIdx === undefined) return
  if (e.ctrlKey) {
    if (selectedRows.value.has(actualIdx)) selectedRows.value.delete(actualIdx)
    else selectedRows.value.add(actualIdx)
  } else {
    selectedRows.value = new Set([actualIdx])
  }
}

const contextMenu = ref({ x: 0, y: 0, show: false })

function showContextMenu(e: MouseEvent) {
  e.preventDefault()
  contextMenu.value = { x: e.clientX, y: e.clientY, show: true }
}

function hideContextMenu() { contextMenu.value.show = false }

async function copyAs(format: string) {
  hideContextMenu()
  const selected = [...selectedRows.value].sort((a, b) => a - b)
  const rows = selected.length > 0
    ? selected.map((i) => props.rows[i])
    : props.rows
  if (rows.length === 0) return
  const colNames = columnDefs.value.filter((c) => c.visible).map((c) => c.key)
  const headers = colNames
  const data = rows.map((r) => colNames.map((_cn, ci) => displayValue(r[ci])))

  let text = ''
  if (format === 'tsv') {
    text = [headers.join('\t'), ...data.map((r) => r.join('\t'))].join('\n')
  } else if (format === 'csv') {
    text = [headers.map((h) => `"${h}"`).join(','), ...data.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(','))].join('\n')
  } else if (format === 'json') {
    const jsonData = rows.map((r) => {
      const obj: Record<string, unknown> = {}
      colNames.forEach((c, i) => { obj[c] = r[i] })
      return obj
    })
    text = JSON.stringify(jsonData, null, 2)
  } else if (format === 'markdown') {
    text = '| ' + headers.join(' | ') + ' |\n|' + headers.map(() => '---').join('|') + '|\n'
    text += data.map((r) => '| ' + r.join(' | ') + ' |').join('\n')
  } else if (format === 'insert') {
    text = rows.map((r) => {
      const vals = colNames.map((_cn, ci) => {
        const v = displayValue(r[ci])
        if (v === '(NULL)' || v === '') return 'NULL'
        if (/^\d+(\.\d+)?$/.test(v)) return v
        return `'${v.replace(/'/g, "''")}'`
      }).join(', ')
      return `INSERT INTO table_name (${headers.join(', ')}) VALUES (${vals});`
    }).join('\n')
  }
  await navigator.clipboard.writeText(text)
}
</script>

<template>
  <div class="virtual-table" @contextmenu="showContextMenu">
    <div class="vt-header">
      <div class="vt-row-num-header">#</div>
      <div v-for="col in columnDefs.filter((c) => c.visible)" :key="col.key" class="vt-header-cell" :style="{ width: col.width + 'px', flexShrink: 0 }">
        <span class="vt-header-title" @click="toggleSort(col.key)">{{ col.title }}{{ sortIcon(col.key) }}</span>
        <div class="vt-resize-handle" @mousedown="startResize($event, col.key)" />
        <input class="vt-filter-input" placeholder="过滤..." :value="filterText[col.key] ?? ''" @input="(e) => filterText[col.key] = (e.target as HTMLInputElement).value" @click.stop />
      </div>
    </div>

    <div ref="scrollContainer" class="vt-body">
      <div :style="{ height: virtualizer.getTotalSize() + 'px', position: 'relative' }">
        <div
          v-for="vRow in virtualizer.getVirtualItems()"
          :key="String(vRow.key)"
          class="vt-row"
          :class="{
            'vt-row--selected': selectedRows.has(processedRows[vRow.index]?.index ?? -1),
            'vt-row--modified': modifiedRows.has(processedRows[vRow.index]?.index ?? -1),
          }"
          :style="{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vRow.start}px)`, height: vRow.size + 'px' }"
          @click="toggleRow($event, vRow.index)"
        >
          <div class="vt-row-num">{{ (processedRows[vRow.index]?.index ?? vRow.index) + 1 }}</div>
          <div
            v-for="(col, colIdx) in columnDefs.filter((c) => c.visible)"
            :key="col.key"
            class="vt-cell"
            :class="{ 'vt-cell--null': isNull(processedRows[vRow.index]?.data[colIdx]) }"
            :style="{ width: col.width + 'px', flexShrink: 0 }"
            @dblclick="startEdit(vRow.index, colIdx)"
          >
            <template v-if="editingCell?.row === vRow.index && editingCell?.col === colIdx">
              <input v-model="editValue" class="vt-cell-input" @keydown.enter="confirmEdit" @keydown.escape="editingCell = null" @blur="confirmEdit" />
            </template>
            <template v-else>{{ displayValue(processedRows[vRow.index]?.data[colIdx]) }}</template>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="contextMenu.show" class="vt-context-overlay" @click="hideContextMenu">
        <div class="vt-context-menu" :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }">
          <div class="vt-context-item" @click="copyAs('tsv')">复制为 TSV</div>
          <div class="vt-context-item" @click="copyAs('csv')">复制为 CSV</div>
          <div class="vt-context-item" @click="copyAs('json')">复制为 JSON</div>
          <div class="vt-context-item" @click="copyAs('markdown')">复制为 Markdown</div>
          <div class="vt-context-item" @click="copyAs('insert')">复制为 INSERT</div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.virtual-table { display: flex; flex-direction: column; height: 100%; font-size: 13px; }
.vt-header { display: flex; border-bottom: 1px solid var(--lb-border-color); background: var(--lb-bg-secondary); overflow: hidden; flex-shrink: 0; }
.vt-header-cell { padding: 4px 8px; position: relative; border-right: 1px solid var(--lb-border-color); box-sizing: border-box; }
.vt-header-title { cursor: pointer; user-select: none; font-weight: 600; font-size: 12px; color: var(--lb-text-primary); }
.vt-resize-handle { position: absolute; right: 0; top: 0; bottom: 0; width: 4px; cursor: col-resize; }
.vt-resize-handle:hover { background: var(--lb-accent-color); }
.vt-filter-input { width: 100%; border: 1px solid var(--lb-border-color); border-radius: 2px; padding: 1px 4px; font-size: 11px; background: var(--lb-bg-primary); color: var(--lb-text-primary); margin-top: 2px; outline: none; box-sizing: border-box; }
.vt-body { flex: 1; overflow: auto; }
.vt-row { display: flex; border-bottom: 1px solid var(--lb-border-color); cursor: default; }
.vt-row:hover { background: var(--lb-hover-bg); }
.vt-row--selected { background: rgba(24, 144, 255, 0.1); }
.vt-row--modified { background: rgba(240, 160, 32, 0.1); }
.vt-row-num { width: 40px; padding: 4px 6px; text-align: right; font-size: 11px; color: var(--lb-text-secondary); flex-shrink: 0; border-right: 1px solid var(--lb-border-color); }
.vt-row-num-header { width: 40px; padding: 4px 6px; text-align: right; font-size: 11px; font-weight: 600; color: var(--lb-text-secondary); flex-shrink: 0; border-right: 1px solid var(--lb-border-color); }
.vt-cell { padding: 4px 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--lb-text-primary); }
.vt-cell--null { color: var(--lb-text-secondary); font-style: italic; }
.vt-cell-input { width: 100%; border: 1px solid var(--lb-accent-color); border-radius: 2px; padding: 1px 4px; font-size: 13px; background: var(--lb-bg-primary); color: var(--lb-text-primary); outline: none; }
.vt-context-overlay { position: fixed; inset: 0; z-index: 1000; }
.vt-context-menu { position: fixed; background: var(--lb-bg-primary); border: 1px solid var(--lb-border-color); border-radius: 6px; padding: 4px 0; min-width: 180px; box-shadow: 0 4px 16px rgba(0,0,0,0.1); }
.vt-context-item { padding: 6px 12px; cursor: pointer; font-size: 13px; color: var(--lb-text-primary); }
.vt-context-item:hover { background: var(--lb-hover-bg); }
</style>
