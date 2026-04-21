import { Port } from './portTypes'

export interface NodeModel {
  id: string
  type: string
  data: any
  ports: Port[]
}
