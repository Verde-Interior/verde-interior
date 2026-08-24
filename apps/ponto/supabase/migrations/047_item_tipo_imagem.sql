-- Migration 047: libera tipo 'imagem' em orcamento_itens
--
-- Problema: o gerador cria blocos de imagem com tipo='imagem' (novoItemImagem em
-- GeradorOrcamento.jsx), mas o CHECK criado na 041 só aceitava 'produto' e 'extra'.
-- O INSERT do item falhava e o erro era engolido, então a imagem simplesmente não
-- persistia — o usuário via o bloco na tela e ele sumia no recarregar.

ALTER TABLE public.orcamento_itens
  DROP CONSTRAINT IF EXISTS orcamento_itens_tipo_check;

ALTER TABLE public.orcamento_itens
  ADD CONSTRAINT orcamento_itens_tipo_check
  CHECK (tipo IN ('produto', 'extra', 'imagem'));

COMMENT ON COLUMN public.orcamento_itens.tipo IS
  '''produto'' = planta/vaso | ''extra'' = custo adicional (estacionamento, hora noturna) | ''imagem'' = bloco de imagem full-width, sem preço';
