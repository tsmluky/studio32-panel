import { describe, expect, it } from 'vitest'
import { readGoogleReturn } from './googleReturn'

describe('vuelta desde Google', () => {
  it('sin parámetros no hay aviso', () => {
    expect(readGoogleReturn('')).toBeNull()
    expect(readGoogleReturn('?otra=cosa')).toBeNull()
  })

  it('conectado lleva al negocio que se conectó', () => {
    const vuelta = readGoogleReturn('?google=conectado&org=org-1')
    expect(vuelta?.tone).toBe('success')
    expect(vuelta?.organizationId).toBe('org-1')
  })

  it('cada motivo de error se explica sin jerga', () => {
    expect(readGoogleReturn('?google=error&motivo=permisos')?.message).toContain('permiso')
    expect(readGoogleReturn('?google=error&motivo=caducado')?.message).toContain('caducó')
    expect(readGoogleReturn('?google=error&motivo=inventado')?.message).toContain('Inténtalo de nuevo')
    expect(readGoogleReturn('?google=cancelado')?.tone).toBe('warning')
  })
})
