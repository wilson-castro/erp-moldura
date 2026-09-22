# @erp/moldura

A **moldura** visual comum: topo, menu dos módulos permitidos e toast, igual em todas as apps.

## Responsabilidades

O que esta parte faz, o que nunca faz e o vocabulário usado aqui (BFF, zona, Server Action…), explicados
do zero: [`docs/RESPONSABILIDADES.md`](https://github.com/ArtroxGabriel/nextjs-mfe/blob/bff-multizone/docs/RESPONSABILIDADES.md)
no repositório principal, seção 7.

## O que tem

- `Moldura`: topo, menu com `aria-current`, um `<h1>`, host de toast.
- `emitirToast`, flash entre documentos (`__Host-flash`), `FormularioDeAcao` (ilha que executa a Server Action e troca de documento).

## Comandos

```bash
pnpm install
pnpm test         # testes de menu, toast, flash e FormularioDeAcao
pnpm publicar     # build + publica no Verdaccio local (:4873)
```

**Nunca republique o mesmo número de versão**, nem em outra máquina: mudou, sobe a versão
(ADR-0010 no repositório principal). Ordem de publicação: `erp-contratos` → `erp-nucleo` →
`erp-moldura` → aplicações.

Depende de: peer `react`.

A base inteira (subir, verificar ponta a ponta) é operada pelo repositório principal `nextjs-mfe`: veja o README de lá.
