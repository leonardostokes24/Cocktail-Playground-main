export type PortKind = 'input' | 'output'

export interface Port {
  id: string
  kind: PortKind
  dataType: string
  capacity?: number
  label?: string
}
