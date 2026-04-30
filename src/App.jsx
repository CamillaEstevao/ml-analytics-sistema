import { useEffect, useMemo, useState } from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts"
import {
  BarChart3,
  CalendarDays,
  Download,
  Eye,
  PackageSearch,
  Percent,
  Search,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  RefreshCcw,
} from "lucide-react"
import "./App.css"

const HISTORICO_FILE = "/data/historico_geral.json"

function moneyToNumber(value) {
  if (!value || value === "-") return 0

  return (
    Number(
      String(value)
        .replace("R$", "")
        .replace(/\./g, "")
        .replace(",", ".")
        .trim()
    ) || 0
  )
}

function numberToMoney(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

function percentToNumber(value) {
  if (!value || value === "-") return 0
  return Number(String(value).replace("%", "").replace(",", ".")) || 0
}

function brDateToISO(date) {
  if (!date || !String(date).includes("/")) return ""
  const [d, m, y] = String(date).split("/")
  return `${y}-${m}-${d}`
}

function isoToBR(date) {
  if (!date) return "-"
  const [y, m, d] = date.split("-")
  return `${d}/${m}/${y}`
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/sku[_-]?/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim()
}

function getVariationClass(value) {
  if (!value) return ""
  if (String(value).includes("▲")) return "positive"
  if (String(value).includes("▼")) return "negative"
  return ""
}

function App() {
  const [data, setData] = useState([])
  const [search, setSearch] = useState("")
  const [activeMenu, setActiveMenu] = useState("visao")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [loading, setLoading] = useState(true)

  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  useEffect(() => {
  async function loadData() {
    try {
      const historico = await fetch(HISTORICO_FILE).then((res) => res.json())

      setData(historico)

      if (historico.length > 0) {
        const dates = historico
          .map((row) => brDateToISO(row["Data Análise"]))
          .filter(Boolean)
          .sort()

        const primeiraData = dates[0]
        const ultimaData = dates[dates.length - 1]

        setStartDate(primeiraData)
        setEndDate(ultimaData)
      }
    } catch (error) {
      console.error("Erro ao carregar histórico:", error)
    } finally {
      setLoading(false)
    }
  }

  loadData()
}, [])

const filteredData = useMemo(() => {
  const termoOriginal = search.toLowerCase().trim()
  const termoClean = normalizeText(search)

  const result = data.filter((row) => {
    const sku = String(row["SKU"] || "")
    const mlb = String(row["Ref."] || "")
    const dataIso = brDateToISO(row["Data Análise"])

    const skuClean = normalizeText(sku)
    const mlbClean = normalizeText(mlb)

    const matchesSearch =
      !termoOriginal ||
      sku.toLowerCase().includes(termoOriginal) ||
      mlb.toLowerCase().includes(termoOriginal) ||
      skuClean.includes(termoClean) ||
      mlbClean.includes(termoClean)

    const matchesStart = !startDate || dataIso >= startDate
    const matchesEnd = !endDate || dataIso <= endDate

    return matchesSearch && matchesStart && matchesEnd
  })

  // 🔥 AQUI ESTÁ A MÁGICA
 return result.sort((a, b) => {
  const dateA = brDateToISO(a["Data Análise"])
  const dateB = brDateToISO(b["Data Análise"])

  if (dateA !== dateB) {
    return dateB.localeCompare(dateA)
  }

  return moneyToNumber(b["Vendas Brutas"]) - moneyToNumber(a["Vendas Brutas"])
})

}, [data, search, startDate, endDate])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, startDate, endDate, rowsPerPage])

  const totalPages = Math.ceil(filteredData.length / rowsPerPage)

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage
    return filteredData.slice(start, start + rowsPerPage)
  }, [filteredData, currentPage, rowsPerPage])

  const chartData = useMemo(() => {
    const grouped = {}

    filteredData.forEach((row) => {
      const date = row["Data Análise"]

      if (!grouped[date]) {
        grouped[date] = {
          date,
          vendas: 0,
          visitas: 0,
          conversao: 0,
          qtdConversao: 0,
        }
      }

      grouped[date].vendas += moneyToNumber(row["Vendas Brutas"])
      grouped[date].visitas += Number(row["Visitas"]) || 0

      const conv = percentToNumber(row["Conversão %"])
      if (conv > 0) {
        grouped[date].conversao += conv
        grouped[date].qtdConversao += 1
      }
    })

    return Object.values(grouped)
      .sort((a, b) => brDateToISO(a.date).localeCompare(brDateToISO(b.date)))
      .map((item) => ({
        ...item,
        conversao:
          item.qtdConversao > 0
            ? Number((item.conversao / item.qtdConversao).toFixed(1))
            : 0,
      }))
  }, [filteredData])

  const resumo = useMemo(() => {
    const vendas = filteredData.reduce(
      (acc, row) => acc + moneyToNumber(row["Vendas Brutas"]),
      0
    )

    const visitas = filteredData.reduce(
      (acc, row) => acc + (Number(row["Visitas"]) || 0),
      0
    )

    const quantidade = filteredData.reduce(
      (acc, row) => acc + (Number(row["Quantidade de Vendas"]) || 0),
      0
    )

    const conversao = visitas > 0 ? (quantidade / visitas) * 100 : 0

    return { vendas, visitas, quantidade, conversao }
  }, [filteredData])

  function exportCSV() {
    if (!filteredData.length) return

    const headers = Object.keys(filteredData[0])
    const rows = filteredData.map((row) =>
      headers
        .map((h) => `"${String(row[h] ?? "").replace(/"/g, '""')}"`)
        .join(";")
    )

    const csv = [headers.join(";"), ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)

    const a = document.createElement("a")
    a.href = url
    a.download = "ml-analytics.csv"
    a.click()

    URL.revokeObjectURL(url)
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-badge">ML</div>
          <div>
            <h2>ML Analytics</h2>
            <p>Performance Dashboard</p>
          </div>
        </div>

        <nav className="menu">
          <button
            className={activeMenu === "visao" ? "active" : ""}
            onClick={() => setActiveMenu("visao")}
          >
            <BarChart3 size={18} />
            Visão geral
          </button>

          <button
            className={activeMenu === "sku" ? "active" : ""}
            onClick={() => setActiveMenu("sku")}
          >
            <PackageSearch size={18} />
            Anúncios SKU
          </button>

          <button
            className={activeMenu === "performance" ? "active" : ""}
            onClick={() => setActiveMenu("performance")}
          >
            <TrendingUp size={18} />
            Performance
          </button>
        </nav>

        <div className="sidebar-footer">
          <span>Última atualização</span>
          <strong>{endDate ? isoToBR(endDate) : "-"}</strong>

          <button onClick={() => window.location.reload()}>
            <RefreshCcw size={15} />
            Atualizar dados
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="page-header">
          <div>
            <span className="eyebrow">Mercado Livre Insights</span>

            <h1>
              {activeMenu === "visao" && "Visão Geral"}
              {activeMenu === "sku" && "Anúncios SKU"}
              {activeMenu === "performance" && "Performance"}
            </h1>

            <p>Análise automatizada de vendas, visitas e conversão por SKU.</p>
          </div>

          <div className="header-actions">
            <div className="date-filter">
              <CalendarDays size={17} />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span>até</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <button className="export-btn" onClick={exportCSV}>
              <Download size={17} />
              Exportar
            </button>
          </div>
        </header>

        <section className="metric-grid">
          <MetricCard
            icon={<DollarSign size={22} />}
            label="Vendas Brutas"
            value={numberToMoney(resumo.vendas)}
            description="Receita total no período"
            tone="blue"
          />

          <MetricCard
            icon={<Eye size={22} />}
            label="Visitas"
            value={resumo.visitas.toLocaleString("pt-BR")}
            description="Total de acessos"
            tone="violet"
          />

          <MetricCard
            icon={<Percent size={22} />}
            label="Conversão"
            value={`${resumo.conversao.toFixed(1).replace(".", ",")}%`}
            description="Média geral"
            tone="green"
          />

          <MetricCard
            icon={<ShoppingCart size={22} />}
            label="Qtd. Vendas"
            value={resumo.quantidade.toLocaleString("pt-BR")}
            description="Pedidos convertidos"
            tone="orange"
          />
        </section>

        {activeMenu !== "sku" && (
          <section className="chart-grid">
            <PremiumChart
              title="Vendas Brutas"
              subtitle="Receita diária consolidada"
              data={chartData}
              dataKey="vendas"
              color="#2563eb"
              formatter={numberToMoney}
            />

            <PremiumChart
              title="Visitas"
              subtitle="Volume diário de tráfego"
              data={chartData}
              dataKey="visitas"
              color="#7c3aed"
              formatter={(v) => Number(v).toLocaleString("pt-BR")}
            />

            <PremiumChart
              title="Conversão"
              subtitle="Taxa média por dia"
              data={chartData}
              dataKey="conversao"
              color="#16a34a"
              formatter={(v) => `${String(v).replace(".", ",")}%`}
            />
          </section>
        )}

        <section className="table-card">
          <div className="table-head">
            <div>
              <h3>Performance por SKU</h3>
              <p>
                {loading
                  ? "Carregando dados..."
                  : `${filteredData.length} registros encontrados`}
              </p>
            </div>

            <div className="search-box">
              <Search size={18} />
              <input
                placeholder="Buscar SKU, UTD-092, 092 ou MLB..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>SKU</th>
                  <th>MLB</th>
                  <th>Valor Produto</th>
                  <th>Vendas</th>
                  <th>% Var. Vendas</th>
                  <th>Visitas</th>
                  <th>% Var. Visitas</th>
                  <th>Conversão</th>
                  <th>Qtd.</th>
                  <th>Participação</th>
                </tr>
              </thead>

              <tbody>
                {paginatedData.map((row, index) => (
                  <tr key={`${row["Data Análise"]}-${row["SKU"]}-${row["Ref."]}-${index}`}>
                    <td>{row["Data Análise"]}</td>
                    <td>
                      <strong className="sku-pill">{row["SKU"]}</strong>
                    </td>
                    <td>{row["Ref."]}</td>
                    <td>{row["Valor Produto"]}</td>
                    <td>{row["Vendas Brutas"]}</td>
                    <td
                      className={getVariationClass(
                        row["Comparado c/ o dia anterior Vendas Brutas"]
                      )}
                    >
                      {row["Comparado c/ o dia anterior Vendas Brutas"]}
                    </td>
                    <td>{row["Visitas"]}</td>
                    <td
                      className={getVariationClass(
                        row["Comparado c/ o dia anterior Visitas"]
                      )}
                    >
                      {row["Comparado c/ o dia anterior Visitas"]}
                    </td>
                    <td>{row["Conversão %"]}</td>
                    <td>{row["Quantidade de Vendas"]}</td>
                    <td>{row["% de Participação"]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <span>
              Página {totalPages === 0 ? 0 : currentPage} de {totalPages || 1}
            </span>

            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value))
                setCurrentPage(1)
              }}
            >
              <option value={10}>10 por página</option>
              <option value={20}>20 por página</option>
              <option value={50}>50 por página</option>
              <option value={100}>100 por página</option>
            </select>

            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
            >
              Anterior
            </button>

            <button
              disabled={currentPage >= totalPages}
              onClick={() =>
                setCurrentPage((page) => Math.min(page + 1, totalPages))
              }
            >
              Próxima
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}

function MetricCard({ icon, label, value, description, tone }) {
  return (
    <div className="metric-card">
      <div className={`metric-icon ${tone}`}>{icon}</div>

      <div className="metric-content">
        <span>{label}</span>
        <strong>{value}</strong>

        <div className="metric-footer">
          <p>{description}</p>
        </div>
      </div>
    </div>
  )
}

function PremiumChart({ title, subtitle, data, dataKey, color, formatter }) {
  return (
    <div className="premium-chart">
      <div className="premium-chart-head">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </div>

      <div className="chart-area">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 12, left: -18, bottom: 0 }}
          >
            <defs>
              <linearGradient
                id={`gradient-${dataKey}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor={color} stopOpacity={0.22} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="#edf2f7" vertical={false} />

            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#64748b" }}
              minTickGap={22}
            />

            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
            />

            <Tooltip
              cursor={{
                stroke: color,
                strokeWidth: 1,
                strokeDasharray: "4 4",
              }}
              contentStyle={{
                border: "1px solid #e2e8f0",
                borderRadius: "14px",
                boxShadow: "0 18px 40px rgba(15,23,42,.12)",
                fontSize: "12px",
              }}
              formatter={(value) => [formatter(value), ""]}
              labelFormatter={(label) => `Data: ${label}`}
            />

            <Area
              type="natural"
              dataKey={dataKey}
              stroke={color}
              fill={`url(#gradient-${dataKey})`}
              strokeWidth={2.8}
              dot={false}
              activeDot={{
                r: 5,
                strokeWidth: 3,
                stroke: "#fff",
                fill: color,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default App