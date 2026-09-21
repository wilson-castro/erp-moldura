import type { ReactNode } from 'react'
import { HostDeToast } from './HostDeToast.js'
import type { Flash } from './toast.js'

export type ItemDeMenu = { readonly id: string; readonly rotulo: string; readonly prefixo: string }

export type PropsDaMoldura = {
  /** Módulos permitidos, como o domínio de gestão de acesso os devolveu. */
  menu: readonly ItemDeMenu[]
  /** Id do módulo desta página, para `aria-current`. */
  ativo?: string
  /** Só o nome: a sessão da aplicação não tem mais que isso. */
  usuario?: { readonly nome: string } | null
  flash?: Flash | null
  children: ReactNode
}

/**
 * Moldura comum a shell e zonas (D4: pacote renderizado por toda aplicação). Sem `<h1>`:
 * o título é da página. Links são `<a>` e não `<Link>` porque atravessar zona é troca de
 * documento — um `<Link>` tentaria navegação cliente para uma rota que esta app não tem.
 */
export function Moldura({ menu, ativo, usuario, flash, children }: PropsDaMoldura) {
  return (
    <div className="moldura">
      <header className="moldura-topo">
        <p className="moldura-marca"><a href="/">ERP</a></p>
        {usuario && (
          <div className="moldura-usuario">
            <span>{usuario.nome}</span>
            <form method="post" action="/api/auth/sair">
              <button type="submit">Sair</button>
            </form>
          </div>
        )}
      </header>
      <nav className="moldura-menu" aria-label="Módulos">
        <ul>
          {menu.map((m) => (
            <li key={m.id}>
              <a href={m.prefixo} {...(m.id === ativo ? { 'aria-current': 'page' as const } : {})}>{m.rotulo}</a>
            </li>
          ))}
        </ul>
      </nav>
      <main id="conteudo" className="moldura-conteudo">{children}</main>
      <HostDeToast flash={flash ?? null} />
    </div>
  )
}

/** O módulo do caminho atual: o de prefixo mais longo que o contém. */
export function moduloAtivo(menu: readonly ItemDeMenu[], caminho: string): string | undefined {
  const contem = (p: string) => p === '/' || caminho === p || caminho.startsWith(`${p}/`)
  return [...menu].filter((m) => contem(m.prefixo)).sort((a, b) => b.prefixo.length - a.prefixo.length)[0]?.id
}
