import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const CUTTING_FRACTIONS = [
    { key: 'frente', label: 'FRENTE' },
    { key: 'costas', label: 'COSTAS' },
    { key: 'mangas', label: 'MANGAS' }
];

const SLEEVELESS_FRACTIONS = CUTTING_FRACTIONS.slice(0, 2);

const SIZE_ORDER = ['2', '4', '6', '8', '10', '12', '14', 'PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG', 'XXXG', 'ESP'];

function normalizeKey(value) {
    return String(value || '')
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function sortGrade(grade) {
    return grade.sort((left, right) => {
        const leftIndex = SIZE_ORDER.indexOf(left.tamanho);
        const rightIndex = SIZE_ORDER.indexOf(right.tamanho);

        if (leftIndex === -1 && rightIndex === -1) return left.tamanho.localeCompare(right.tamanho);
        if (leftIndex === -1) return 1;
        if (rightIndex === -1) return -1;
        return leftIndex - rightIndex;
    });
}

function normalizeFinishes(acabamentos) {
    return (Array.isArray(acabamentos) ? acabamentos : [])
        .map((item) => String(item || '').trim())
        .filter(Boolean);
}

function buildLotId(tecido, modelo, acabamentos = [], productionType = '') {
    const tagsKey = normalizeFinishes(acabamentos)
        .map(normalizeKey)
        .sort()
        .join('|');
    const lotId = `${normalizeKey(tecido)}::${normalizeKey(modelo)}${tagsKey ? `::${tagsKey}` : ''}`;
    return productionType ? `${normalizeKey(productionType)}::${lotId}` : lotId;
}

function buildControlKey(loteId, tamanho) {
    return `${loteId}::${normalizeKey(tamanho)}`;
}

function sanitizeQuantity(value) {
    return Math.max(0, Math.trunc(Number(value) || 0));
}

function mapSavedProgress(rows) {
    return (rows || []).reduce((saved, item) => {
        const controlKey = buildControlKey(item.lote_id, item.tamanho);
        saved[controlKey] = {
            ...(saved[controlKey] || {}),
            [item.tipo_peca]: Number(item.quantidade_cortada ?? item.quantidade ?? 0) || 0
        };
        return saved;
    }, {});
}

function agruparPorLote(pedidos, productionType = '') {
    const lotes = new Map();

    (pedidos || []).forEach((pedido) => {
        (pedido.produtos || []).forEach((produto) => {
            const tecido = String(produto.tecido || '').trim() || 'Não Informado';
            const modelo = String(produto.nome_produto || '').trim() || 'Não Informado';
            const acabamentos = normalizeFinishes(produto.acabamentos);
            const tecidoKey = normalizeKey(tecido);
            const acabamentosKey = acabamentos.map(normalizeKey).sort().join('|');
            const modeloKey = `${normalizeKey(modelo)}::${acabamentosKey}`;

            if (!lotes.has(tecidoKey)) {
                lotes.set(tecidoKey, {
                    tecido,
                    modelos: new Map()
                });
            }

            const lote = lotes.get(tecidoKey);
            if (!lote.modelos.has(modeloKey)) {
                lote.modelos.set(modeloKey, {
                    nome_modelo: modelo,
                    acabamentos,
                    grade: new Map(),
                    ids_pedido: new Set()
                });
            }

            const modeloAgrupado = lote.modelos.get(modeloKey);
            modeloAgrupado.ids_pedido.add(pedido.id_pedido);
            (produto.grade || []).forEach(({ tamanho, quantidade }) => {
                const total = Number(quantidade) || 0;
                if (total <= 0) return;

                const tamanhoKey = String(tamanho || '').trim();
                const atual = modeloAgrupado.grade.get(tamanhoKey) || 0;
                modeloAgrupado.grade.set(tamanhoKey, atual + total);
            });
        });
    });

    return Array.from(lotes.values())
        .map((lote) => {
            const modelos = Array.from(lote.modelos.values())
                .map((modelo) => ({
                    nome_modelo: modelo.nome_modelo,
                    acabamentos: modelo.acabamentos,
                    ids_pedido: Array.from(modelo.ids_pedido),
                    grade: sortGrade(
                        Array.from(modelo.grade.entries()).map(([tamanho, quantidade]) => ({
                            tamanho,
                            quantidade
                        }))
                    ),
                    lote_ids: Array.from(new Set([
                        buildLotId(lote.tecido, modelo.nome_modelo, modelo.acabamentos, productionType),
                        ...(modelo.acabamentos.length === 0
                            ? [buildLotId(lote.tecido, modelo.nome_modelo)]
                            : [])
                    ]))
                }));

            const totalPecas = modelos.reduce(
                (total, modelo) => total + modelo.grade.reduce((soma, item) => soma + item.quantidade, 0),
                0
            );

            return {
                tecido: lote.tecido,
                modelos,
                totalPecas
            };
        });
}

function getFractionsForModel(modelName) {
    const normalizedModel = normalizeKey(modelName);

    if (
        normalizedModel.includes('short')
        || normalizedModel.includes('calcao')
        || normalizedModel.includes('regata')
    ) {
        return SLEEVELESS_FRACTIONS;
    }

    return CUTTING_FRACTIONS;
}

function isModelComplete(modelo, progress) {
    if (modelo.grade.length === 0) return false;

    const fractions = getFractionsForModel(modelo.nome_modelo);
    return modelo.grade.every(({ tamanho, quantidade }) => {
        const values = modelo.lote_ids
            .map((loteId) => progress[buildControlKey(loteId, tamanho)])
            .find(Boolean) || {};
        return fractions.every(({ key }) => Number(values[key] || 0) === quantidade);
    });
}

function QuantityControl({ fraction, meta, value, onChange, onCommit, readOnly }) {
    const shownValue = readOnly ? meta : sanitizeQuantity(value);
    const cutQuantity = readOnly ? meta : sanitizeQuantity(value);
    const remaining = Math.max(0, meta - cutQuantity);
    const excess = Math.max(0, cutQuantity - meta);
    const isComplete = readOnly || cutQuantity === meta;

    return (
        <div className="flex min-w-[120px] flex-col items-center gap-1">
            <label className="text-center text-xs font-semibold text-slate-600">{fraction.label}</label>
            <div className="flex h-8 overflow-hidden rounded-md border border-slate-300 bg-white">
                <button
                    type="button"
                    disabled={readOnly}
                    className="w-8 bg-slate-100 text-base font-bold text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:text-slate-300"
                    aria-label={`Diminuir ${fraction.label}`}
                    onClick={() => {
                        const nextValue = Math.max(0, sanitizeQuantity(value) - 1);
                        onChange(nextValue);
                        onCommit(nextValue);
                    }}
                >
                    -
                </button>
                <input
                    type="number"
                    min="0"
                    disabled={readOnly}
                    value={shownValue}
                    placeholder={String(meta)}
                    onChange={(event) => {
                        const nextValue = event.target.value;
                        onChange(nextValue === '' ? '' : sanitizeQuantity(nextValue));
                    }}
                    onBlur={(event) => onCommit(sanitizeQuantity(event.target.value))}
                    className="h-8 w-16 border-x border-slate-300 text-center text-sm font-bold text-slate-900 outline-none placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-600"
                />
                <button
                    type="button"
                    disabled={readOnly}
                    className="w-8 bg-slate-100 text-base font-bold text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:text-slate-300"
                    aria-label={`Aumentar ${fraction.label}`}
                    onClick={() => {
                        const nextValue = sanitizeQuantity(value) + 1;
                        onChange(nextValue);
                        onCommit(nextValue);
                    }}
                >
                    +
                </button>
            </div>
            <span className={`text-xs font-bold ${isComplete ? 'text-green-600' : 'text-red-600'}`}>
                {isComplete ? '✅ Concluído' : (excess > 0 ? `Excede ${excess}` : `Falta ${remaining}`)}
            </span>
        </div>
    );
}

function GradeRow({ loteId, progressLotIds, tamanho, quantidade, fractions, progress, onProgressChange, onAutoSave, readOnly }) {
    const controlKey = buildControlKey(loteId, tamanho);
    const savedValues = progressLotIds
        .map((savedLotId) => progress[buildControlKey(savedLotId, tamanho)])
        .find(Boolean) || {};
    const values = readOnly
        ? Object.fromEntries(fractions.map(({ key }) => [key, quantidade]))
        : savedValues;
    const isComplete = fractions.every(({ key }) => Number(values[key] || 0) === quantidade);

    return (
        <article
            className={`flex flex-col gap-4 rounded-lg border px-3 py-3 transition-colors sm:flex-row sm:items-center ${
                isComplete ? 'border-green-300 bg-green-50' : 'border-red-200 bg-white'
            }`}
        >
            <div className="flex shrink-0 items-center gap-3 border-slate-200 sm:w-32 sm:border-r sm:pr-3">
                <span className="rounded-md bg-slate-100 px-3 py-2 text-lg font-black text-slate-900">{tamanho}</span>
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Meta</p>
                    <p className="text-sm font-black text-blue-700">{quantidade}</p>
                </div>
            </div>
            <div className="flex flex-1 flex-wrap gap-4 sm:gap-6">
                {fractions.map((fraction) => (
                    <QuantityControl
                        key={fraction.key}
                        fraction={fraction}
                        meta={quantidade}
                        value={values[fraction.key]}
                        onChange={(value) => onProgressChange(controlKey, fraction.key, value)}
                        onCommit={(value) => onAutoSave(loteId, tamanho, fraction.key, value)}
                        readOnly={readOnly}
                    />
                ))}
            </div>
            <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                    isComplete ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-700'
                }`}
            >
                {isComplete ? 'Lote completo' : 'Pendente'}
            </span>
        </article>
    );
}

function ModelGrade({
    model,
    tissueKey,
    productionType,
    progress,
    onProgressChange,
    onAutoSave,
    readOnly,
    canArchive,
    isArchiving,
    onArchive
}) {
    const fractions = getFractionsForModel(model.nome_modelo);
    const loteId = buildLotId(tissueKey, model.nome_modelo, model.acabamentos, productionType);

    return (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="p-4 sm:p-5">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                        <h3 className="text-lg font-bold uppercase text-slate-950">
                            {model.nome_modelo} {tissueKey}
                            {model.acabamentos.length > 0 && ` (${model.acabamentos.join(' | ')})`}
                        </h3>
                    </div>
                    <p className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-600">
                        {fractions.map((fraction) => fraction.label).join(' + ')}
                    </p>
                </div>

                <div>
                    <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Grade Total do Lote</p>
                    <div className="flex flex-wrap gap-4">
                        {model.grade.map(({ tamanho, quantidade }) => (
                            <div
                                key={`resumo-${tissueKey}-${model.nome_modelo}-${model.acabamentos.join('-')}-${tamanho}`}
                                className="flex min-w-[80px] flex-col items-center justify-center rounded-md border border-slate-200 bg-slate-50 p-3"
                            >
                                <span className="text-sm font-bold text-slate-600">{tamanho}</span>
                                <span className="text-xl font-black text-slate-800">{quantidade}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="my-5 border-t border-slate-200" />

                <div className="space-y-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Controle de Corte Fracionado</p>
                    {model.grade.map(({ tamanho, quantidade }) => (
                        <GradeRow
                            key={`${tissueKey}-${model.nome_modelo}-${model.acabamentos.join('-')}-${tamanho}`}
                            loteId={loteId}
                            progressLotIds={model.lote_ids}
                            tamanho={tamanho}
                            quantidade={quantidade}
                            fractions={fractions}
                            progress={progress}
                            onProgressChange={onProgressChange}
                            onAutoSave={onAutoSave}
                            readOnly={readOnly}
                        />
                    ))}
                    {model.grade.length === 0 && (
                        <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-800">
                            Grade não informada. Aguardando tamanhos e quantidades do pedido.
                        </p>
                    )}
                </div>
            </div>

            {canArchive && (
                <button
                    type="button"
                    disabled={isArchiving}
                    onClick={onArchive}
                    className="mt-4 w-full rounded-b-lg bg-green-600 py-3 font-bold uppercase text-white hover:bg-green-700 disabled:cursor-wait disabled:bg-green-400"
                >
                    {isArchiving ? 'Enviando para costura...' : '✅ Enviar Lote para Costura (Arquivar)'}
                </button>
            )}
        </section>
    );
}

export default function CutterDashboard() {
    const { token, API_BASE_URL } = useAuth();
    const [activeTab, setActiveTab] = useState('Sublimacao');
    const [activePedidos, setActivePedidos] = useState([]);
    const [historicoPedidos, setHistoricoPedidos] = useState([]);
    const [progress, setProgress] = useState({});
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [saveStatus, setSaveStatus] = useState('idle');
    const [finalizingLot, setFinalizingLot] = useState('');
    const [finalizeStatus, setFinalizeStatus] = useState('');
    const [refreshVersion, setRefreshVersion] = useState(0);
    const pendingSavesRef = useRef(new Map());
    const savingStateRef = useRef({ pending: 0, failed: false });

    useEffect(() => {
        let isActive = true;
        let requestInFlight = false;

        const loadCuttingOrders = async () => {
            if (requestInFlight) return;
            requestInFlight = true;

            try {
                const authConfig = {
                    headers: { Authorization: `Bearer ${token}` }
                };
                const [ordersResponse, historicalResponse, progressResponse] = await Promise.all([
                    axios.get(`${API_BASE_URL}/corte/pedidos`, authConfig),
                    axios.get(`${API_BASE_URL}/corte/pedidos?aba=historico`, authConfig),
                    axios.get(`${API_BASE_URL}/corte/progresso`, authConfig)
                ]);

                if (!isActive) return;
                setActivePedidos(Array.isArray(ordersResponse.data) ? ordersResponse.data : []);
                setHistoricoPedidos(Array.isArray(historicalResponse.data) ? historicalResponse.data : []);
                const savedProgress = mapSavedProgress(progressResponse.data);
                setProgress((current) => {
                    const merged = { ...savedProgress };
                    Object.entries(current).forEach(([key, values]) => {
                        merged[key] = { ...(merged[key] || {}), ...values };
                    });
                    return merged;
                });
                setLoadError('');
            } catch (error) {
                if (!isActive) return;
                console.error('Erro ao carregar pedidos do corte:', error);
                setActivePedidos([]);
                setHistoricoPedidos([]);
                setProgress({});
                setLoadError('Não foi possível carregar os pedidos reais do corte. Verifique a conexão com a API.');
            } finally {
                if (isActive) setLoading(false);
                requestInFlight = false;
            }
        };

        let pollingId;
        if (token) {
            loadCuttingOrders();
            pollingId = window.setInterval(loadCuttingOrders, 10000);
        }

        return () => {
            isActive = false;
            if (pollingId) window.clearInterval(pollingId);
        };
    }, [API_BASE_URL, token, refreshVersion]);

    const isHistory = activeTab === 'Historico';
    const pedidosVisiveis = useMemo(() => {
        if (isHistory) return historicoPedidos;
        return activePedidos.filter((pedido) => pedido.tipo_producao === activeTab);
    }, [activePedidos, activeTab, historicoPedidos, isHistory]);
    const productionType = isHistory ? '' : activeTab;
    const lotes = useMemo(() => agruparPorLote(pedidosVisiveis, productionType), [pedidosVisiveis, productionType]);

    const updateProgress = (controlKey, fractionKey, value) => {
        setProgress((current) => ({
            ...current,
            [controlKey]: {
                ...current[controlKey],
                [fractionKey]: value
            }
        }));
    };

    const handleAutoSave = (loteId, tamanho, tipoPeca, valor) => {
        const saveKey = `${buildControlKey(loteId, tamanho)}::${tipoPeca}`;
        const previousSave = pendingSavesRef.current.get(saveKey) || Promise.resolve();
        const quantity = sanitizeQuantity(valor);

        if (savingStateRef.current.pending === 0) {
            savingStateRef.current.failed = false;
        }
        savingStateRef.current.pending += 1;
        setSaveStatus('saving');

        const queuedSave = previousSave
            .catch(() => undefined)
            .then(() => axios.post(
                `${API_BASE_URL}/corte/salvar-progresso`,
                {
                    lote_id: loteId,
                    tamanho,
                    tipo_peca: tipoPeca,
                    quantidade: quantity
                },
                { headers: { Authorization: `Bearer ${token}` } }
            ))
            .catch((error) => {
                console.error('Erro ao salvar progresso do corte:', error);
                savingStateRef.current.failed = true;
            })
            .finally(() => {
                savingStateRef.current.pending -= 1;
                if (pendingSavesRef.current.get(saveKey) === queuedSave) {
                    pendingSavesRef.current.delete(saveKey);
                }
                if (savingStateRef.current.pending === 0) {
                    setSaveStatus(savingStateRef.current.failed ? 'error' : 'saved');
                }
            });

        pendingSavesRef.current.set(saveKey, queuedSave);
    };

    const arquivarLote = async (modelo) => {
        const lotKey = modelo.lote_ids[0];
        setFinalizingLot(lotKey);
        setFinalizeStatus('');

        try {
            await Promise.all(Array.from(pendingSavesRef.current.values()));
            const response = await axios.post(
                `${API_BASE_URL}/corte/arquivar`,
                {
                    ids_pedido: modelo.ids_pedido,
                    lote_ids: modelo.lote_ids
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const finalizedIds = new Set(response.data?.ids_pedido || modelo.ids_pedido);

            setActivePedidos((current) => current.filter((pedido) => !finalizedIds.has(pedido.id_pedido)));
            setFinalizeStatus('Lote finalizado e enviado para Costura Iniciada.');
            setRefreshVersion((current) => current + 1);
        } catch (error) {
            console.error('Erro ao finalizar lote de corte:', error);
            setFinalizeStatus('Não foi possível finalizar o lote. Tente novamente.');
        } finally {
            setFinalizingLot('');
        }
    };

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
                <header className="mb-8">
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">PCP / Produção em Massa</p>
                        {saveStatus === 'saving' && (
                            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                                🔄 Salvando...
                            </span>
                        )}
                        {saveStatus === 'saved' && (
                            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">
                                🟢 Alterações salvas automaticamente
                            </span>
                        )}
                        {saveStatus === 'error' && (
                            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
                                Falha ao salvar. Tente novamente.
                            </span>
                        )}
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-950">Painel de Lotes de Corte</h1>
                    <p className="mt-2 max-w-3xl text-slate-600">
                        Metas globais somadas por tecido, modelo e tamanho antes de liberar a costura.
                    </p>
                    <nav className="mt-6 flex flex-wrap gap-2 rounded-xl bg-slate-100 p-1.5" aria-label="Visões do painel de corte">
                        {[
                            { id: 'Sublimacao', label: '👕 Corte Sublimação' },
                            { id: 'Algodao', label: '🧵 Corte Algodão' },
                            { id: 'Historico', label: '🕒 Histórico de Cortes' }
                        ].map(({ id, label }) => (
                            <button
                                key={id}
                                type="button"
                                onClick={() => setActiveTab(id)}
                                className={`rounded-lg px-4 py-3 text-sm font-bold transition-colors ${
                                    activeTab === id
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'bg-transparent text-slate-600 hover:bg-white hover:text-slate-900'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </nav>
                    {loading && <p className="mt-3 text-sm font-medium text-blue-700">Carregando lotes liberados para corte...</p>}
                    {loadError && (
                        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                            {loadError}
                        </p>
                    )}
                    {finalizeStatus && (
                        <p className={`mt-3 text-sm font-bold ${
                            finalizeStatus.startsWith('Não') ? 'text-red-700' : 'text-green-700'
                        }`}>
                            {finalizeStatus}
                        </p>
                    )}
                </header>

                <section className="space-y-8" aria-label="Lotes de corte agrupados por tecido">
                    {lotes.map((lote) => {
                        const lotKey = normalizeKey(lote.tecido);

                        return (
                            <article
                                key={lotKey}
                                className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow-sm"
                            >
                                <div className="p-5 sm:p-6">
                                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 pb-4">
                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Rolo de tecido</p>
                                            <h2 className="text-2xl font-black uppercase tracking-tight text-slate-950">
                                                Lote de Corte: {lote.tecido}
                                            </h2>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {isHistory && (
                                                <span className="rounded-full bg-green-100 px-4 py-2 text-sm font-bold text-green-700">
                                                    Em Costura
                                                </span>
                                            )}
                                            <span className="rounded-full bg-blue-600 px-4 py-2 text-sm font-bold text-white">
                                                {lote.totalPecas} peças no lote
                                            </span>
                                        </div>
                                    </div>

                                    <div className="space-y-5">
                                        {lote.modelos.map((modelo) => {
                                            const modelLotKey = modelo.lote_ids[0];

                                            return (
                                                <ModelGrade
                                                    key={`${normalizeKey(lote.tecido)}-${normalizeKey(modelo.nome_modelo)}-${modelo.acabamentos.join('-')}`}
                                                    model={modelo}
                                                    tissueKey={lote.tecido}
                                                    productionType={productionType}
                                                    progress={progress}
                                                    onProgressChange={updateProgress}
                                                    onAutoSave={handleAutoSave}
                                                    readOnly={isHistory}
                                                    canArchive={!isHistory && isModelComplete(modelo, progress)}
                                                    isArchiving={finalizingLot === modelLotKey}
                                                    onArchive={() => arquivarLote(modelo)}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            </article>
                        );
                    })}

                    {!loading && lotes.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
                            {isHistory ? 'Nenhum lote finalizado no histórico.' : 'Nenhum lote liberado para corte.'}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}
