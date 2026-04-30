import json
from pathlib import Path
from datetime import datetime

BASE_DIR = Path(__file__).parent

DATA_DIR = BASE_DIR.parent / "public" / "data"
HISTORICO_FILE = DATA_DIR / "historico_geral.json"
INDEX_FILE = DATA_DIR / "index.json"


ARQUIVOS_IGNORADOS = {
    "historico_geral.json",
    "arquivos_processados.json",
    "index.json",
    "mapeamento.json",
}


def carregar_json(caminho, padrao):
    if not caminho.exists():
        return padrao

    try:
        with open(caminho, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return padrao


def salvar_json(caminho, dados):
    with open(caminho, "w", encoding="utf-8") as f:
        json.dump(dados, f, ensure_ascii=False, indent=2)


def nome_sku_do_arquivo(nome_arquivo):
    return (
        nome_arquivo
        .replace(".json", "")
        .replace("SKU_", "")
        .replace("SKU-", "")
    )


def br_date_to_sort(date_str):
    try:
        return datetime.strptime(str(date_str), "%d/%m/%Y")
    except Exception:
        return datetime.min


def chave_unica(row):
    return "|".join([
        str(row.get("Data Análise", "")).strip(),
        str(row.get("SKU", "")).strip(),
        str(row.get("Ref.", "")).strip(),
    ])


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    historico_antigo = carregar_json(HISTORICO_FILE, [])

    historico_por_chave = {
        chave_unica(row): row
        for row in historico_antigo
        if isinstance(row, dict)
    }

    if INDEX_FILE.exists():
        arquivos = carregar_json(INDEX_FILE, [])
    else:
        arquivos = [
            arquivo.name
            for arquivo in DATA_DIR.glob("*.json")
            if arquivo.name not in ARQUIVOS_IGNORADOS
        ]

    registros_lidos = 0
    registros_adicionados = 0
    registros_atualizados = 0
    arquivos_lidos = 0

    for nome_arquivo in arquivos:
        if nome_arquivo in ARQUIVOS_IGNORADOS:
            continue

        caminho_arquivo = DATA_DIR / nome_arquivo

        if not caminho_arquivo.exists():
            continue

        dados = carregar_json(caminho_arquivo, [])

        if not isinstance(dados, list):
            continue

        sku = nome_sku_do_arquivo(nome_arquivo)
        arquivos_lidos += 1

        for row in dados:
            if not isinstance(row, dict):
                continue

            row_com_sku = {
                **row,
                "SKU": row.get("SKU") or sku,
            }

            chave = chave_unica(row_com_sku)
            registros_lidos += 1

            if chave in historico_por_chave:
                historico_por_chave[chave] = row_com_sku
                registros_atualizados += 1
            else:
                historico_por_chave[chave] = row_com_sku
                registros_adicionados += 1

    historico_final = list(historico_por_chave.values())

    historico_final.sort(
        key=lambda row: (
            br_date_to_sort(row.get("Data Análise", "")),
            str(row.get("SKU", "")),
            str(row.get("Ref.", "")),
        ),
        reverse=False
    )

    salvar_json(HISTORICO_FILE, historico_final)

    print("Histórico geral atualizado com sucesso.")
    print(f"Arquivos lidos: {arquivos_lidos}")
    print(f"Registros lidos dos SKUs: {registros_lidos}")
    print(f"Registros adicionados: {registros_adicionados}")
    print(f"Registros atualizados: {registros_atualizados}")
    print(f"Total no histórico geral: {len(historico_final)}")


if __name__ == "__main__":
    main()