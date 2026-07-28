# Visão Computacional (MVP) — serviço isolado no check_visaodono

## Branch

Trabalho na branch `feat/visao-computacional`.

- `master` / produção **não muda** até existir merge deliberado (PR).
- Commits desta feature ficam só nesta branch.
- Banco: usar `vision_check_dev` (nunca produção) quando houver persistência.

## Etapa atual — prova de stream

Objetivo: abrir câmera e gravar 1 snapshot.

```bash
cd visao
python -m venv .venv
# Windows:
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
# edite VISAO_RTSP_URL e credenciais

python -m scripts.test_stream
# smoke test sem câmera:
python -m scripts.test_stream --webcam

# Demo ao vivo com YOLOv11n (pessoas):
python -m scripts.live_demo --webcam
# Teclas: q sair | s snapshot
```

## Cloud / P2P vs RTSP

O app da loja (Cloud + serial + porta 37777) é típico Dahua/Intelbras P2P.
**OpenCV não conecta em serial Cloud diretamente.**

Caminhos viáveis:

1. **RTSP no IP local** da loja / VPN / túnel (preferido)
2. SDK / bridge do fabricante que exponha RTSP ou frames
3. Webcam local só para validar o pipeline de código

Preencha `VISAO_RTSP_URL` no `.env` quando tiver o endereço.

## Próximas etapas (depois do stream estável)

1. Detecção de pessoas (YOLO)
2. Tracking (ByteTrack)
3. Eventos por ROI → API Node / Postgres `_dev`
4. Tela no frontend do check_visaodono
