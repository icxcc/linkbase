import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Connection {
  id: string
  name: string
  host: string
  port: number
  database?: string
  username?: string
}

export const useConnectionStore = defineStore('connection', () => {
  const connections = ref<Connection[]>([])
  const currentConnectionId = ref<string | null>(null)

  function addConnection(connection: Connection) {
    connections.value.push(connection)
  }

  function removeConnection(id: string) {
    connections.value = connections.value.filter((c) => c.id !== id)
    if (currentConnectionId.value === id) {
      currentConnectionId.value = null
    }
  }

  function setCurrentConnection(id: string | null) {
    currentConnectionId.value = id
  }

  return {
    connections,
    currentConnectionId,
    addConnection,
    removeConnection,
    setCurrentConnection,
  }
})
