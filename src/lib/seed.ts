import type { PageText, Paper, TextBlock } from '../types'

function blocks(page: number, items: Array<[TextBlock['kind'], string]>): PageText {
  return {
    number: page,
    blocks: items.map((pair, index) => ({ id: 'p' + page + 'b' + index, kind: pair[0], text: pair[1] })),
  }
}

interface SeedInput {
  id: string
  title: string
  authors: string
  year: string
  venue: string
  tags: string[]
  status: Paper['status']
  summary: string
  notes: string
  pages: PageText[]
}

const SEEDS: SeedInput[] = [
  {
    id: 'demo_rag',
    title: 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks',
    authors: 'Patrick Lewis, Ethan Perez, Aleksandra Piktus, et al.',
    year: '2020',
    venue: 'NeurIPS',
    tags: ['RAG', 'NLP', '检索增强'],
    status: 'done',
    summary:
      '把参数化记忆（seq2seq 生成模型）与非参数化记忆（稠密向量索引）结合，用查询检索 top-k 文档作为条件生成依据，在开放域问答上刷新 SOTA，并显著降低幻觉。',
    notes:
      '核心贡献：RAG-Sequence 与 RAG-Token 两种边缘化方式。\n\n要点：\n1. 检索器 DPR + 生成器 BART，端到端联合微调。\n2. 知识可更新，无需重训模型 —— 换索引即可。\n3. 局限：检索质量直接决定上限；top-k 大时延迟高。',
    pages: [
      blocks(1, [
        ['title', 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks'],
        ['meta', 'Patrick Lewis, Ethan Perez, Aleksandra Piktus, Fabio Petroni, Vladimir Karpukhin, Naman Goyal, Heinrich Kuttler, Mike Lewis, Wen-tau Yih, Tim Rocktaschel, Sebastian Riedel, Douwe Kiela'],
        ['heading', 'Abstract'],
        ['body', 'Large pre-trained language models have been shown to store factual knowledge in their parameters, and achieve state-of-the-art results when fine-tuned on downstream NLP tasks. However, their ability to access and precisely manipulate knowledge is still limited, and hence on knowledge-intensive tasks their performance lags behind task-specific architectures.'],
        ['body', 'We explore a general-purpose fine-tuning recipe for retrieval-augmented generation (RAG) — models which combine pre-trained parametric and non-parametric memory for language generation. We introduce RAG models where the parametric memory is a pre-trained seq2seq model and the non-parametric memory is a dense vector index of Wikipedia, accessed with a pre-trained neural retriever.'],
        ['body', 'We compare two formulations, one which conditions on the same retrieved passages across the whole generated sequence, the other which can use different passages for each token. We find that RAG models generate more specific, diverse and factual language than a state-of-the-art parametric-only seq2seq baseline.'],
      ]),
      blocks(2, [
        ['heading', '1 Introduction'],
        ['body', 'Pre-trained neural language models have been shown to learn a substantial amount of in-depth knowledge from data. They can do so without any access to an external memory, as a parameterized implicit knowledge base.'],
        ['body', 'However, this approach has several drawbacks: it is expensive to update the model when the world changes, and it is difficult to provide provenance for generated text. Hybrid models that combine parametric and non-parametric memory can address both problems.'],
        ['heading', '2 Methods'],
        ['body', 'We use a dense retriever to retrieve the top-k documents for an input query, and marginalize over them during generation. The retriever is trained with a maximum inner product search objective using question-document pairs.'],
        ['body', 'The generator is a BART-large model. During fine-tuning both the retriever and the generator are updated jointly, which we find improves performance significantly.'],
      ]),
    ],
  },
  {
    id: 'demo_transformer',
    title: 'Attention Is All You Need',
    authors: 'Ashish Vaswani, Noam Shazeer, Niki Parmar, et al.',
    year: '2017',
    venue: 'NeurIPS',
    tags: ['Transformer', '注意力机制', '基础架构'],
    status: 'done',
    summary: '提出完全基于注意力机制的 Transformer 架构，抛弃循环与卷积，训练并行度大幅提升，在机器翻译上达到 SOTA。',
    notes: '看家论文，必读。\n\n关键：自注意力 O(n^2) 复杂度、多头机制、位置编码（正弦）。\n\n疑问：为什么正弦位置编码比可学习编码在长序列泛化更好？后续 RoPE 给出了新答案。',
    pages: [
      blocks(1, [
        ['title', 'Attention Is All You Need'],
        ['meta', 'Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones, Aidan N. Gomez, Lukasz Kaiser, Illia Polosukhin'],
        ['heading', 'Abstract'],
        ['body', 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism.'],
        ['body', 'We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely. Experiments on two machine translation tasks show these models to be superior in quality while being more parallelizable and requiring significantly less time to train.'],
      ]),
      blocks(2, [
        ['heading', '3 Model Architecture'],
        ['body', 'The Transformer follows an encoder-decoder architecture using stacked self-attention and point-wise, fully connected layers for both the encoder and decoder.'],
        ['body', 'An attention function can be described as mapping a query and a set of key-value pairs to an output, where the query, keys, values, and output are all vectors. Scaled dot-product attention computes the compatibility of query with each key.'],
        ['heading', '3.2 Attention'],
        ['body', 'Multi-head attention allows the model to jointly attend to information from different representation subspaces at different positions. With a single attention head, averaging inhibits this.'],
        ['body', 'Since our model contains no recurrence and no convolution, we add positional encodings to the input embeddings in order to make use of the order of the sequence.'],
      ]),
    ],
  },
  {
    id: 'demo_lora',
    title: 'LoRA: Low-Rank Adaptation of Large Language Models',
    authors: 'Edward J. Hu, Yelong Shen, Phillip Wallis, et al.',
    year: '2021',
    venue: 'ICLR',
    tags: ['微调', '高效训练', 'LLM'],
    status: 'reading',
    summary: '冻结预训练权重，注入可训练的低秩分解矩阵，把可训练参数量降低 10000 倍、显存降低 3 倍，效果与全量微调相当。',
    notes: '实用价值极高，工程上直接可用。\n\n读到这里：低秩矩阵 A 随机初始化、B 置零，保证训练开始等同于原模型。\n\n待查：rank 选择经验值、与 Adapter 的取舍。',
    pages: [
      blocks(1, [
        ['title', 'LoRA: Low-Rank Adaptation of Large Language Models'],
        ['meta', 'Edward J. Hu, Yelong Shen, Phillip Wallis, Zeyuan Allen-Zhu, Yuanzhi Li, Shean Wang, Lu Wang, Weizhu Chen'],
        ['heading', 'Abstract'],
        ['body', 'An important paradigm of natural language processing consists of large-scale pre-training on general domain data and adaptation to particular tasks or domains. As we pre-train larger models, full fine-tuning becomes less feasible because of the increasing number of parameters.'],
        ['body', 'We propose Low-Rank Adaptation, or LoRA, which freezes the pre-trained model weights and injects trainable rank decomposition matrices into each layer of the Transformer architecture, greatly reducing the number of trainable parameters for downstream tasks.'],
      ]),
      blocks(2, [
        ['heading', '4 Method'],
        ['body', 'We initialize A using a random Gaussian initialization and B to zero, so that the update is zero at the beginning of training. We then scale the update by alpha divided by the rank.'],
        ['body', 'LoRA possesses several key advantages. A pre-trained model can be shared and used to build many small LoRA modules for different tasks. LoRA makes training more efficient and lowers the hardware barrier to entry by up to 3 times.'],
      ]),
    ],
  },
  {
    id: 'demo_graphrag',
    title: 'GraphRAG: Knowledge Graph Enhanced Retrieval for Long Documents',
    authors: 'Anonymous Lab',
    year: '2024',
    venue: 'arXiv',
    tags: ['RAG', '知识图谱', '长期记忆'],
    status: 'reading',
    summary: '用实体与关系构建知识图谱，把图结构作为检索骨架，缓解长文档下的全局性问题（global sensemaking）。',
    notes: '和 RAG 那篇对照看：RAG 是扁平 chunk 检索，GraphRAG 把 chunk 关系显式化。\n\n成本问题：建图很贵，社区摘要需要多次 LLM 调用。',
    pages: [
      blocks(1, [
        ['title', 'GraphRAG: Knowledge Graph Enhanced Retrieval for Long Documents'],
        ['heading', 'Abstract'],
        ['body', 'Retrieval-augmented generation over long document collections struggles with queries that require global understanding, since flat chunk retrieval only returns locally relevant passages.'],
        ['body', 'We build an entity and relation graph over the corpus, cluster it into communities, and summarize each community. At query time the system routes between local passage retrieval and community summaries.'],
      ]),
      blocks(2, [
        ['heading', '3 Pipeline'],
        ['body', 'The indexing pipeline extracts entities and relations with an instruction-tuned model, resolves coreferences, and stores the result in a property graph. Community detection uses hierarchical Leiden clustering.'],
        ['body', 'We observe significant gains on sensemaking questions, at the cost of a higher indexing budget and increased index staleness for frequently updated corpora.'],
      ]),
    ],
  },
  {
    id: 'demo_claude_code',
    title: 'Tool-Augmented Agents for Repository-Level Code Editing',
    authors: 'Chen, Park, Rahman',
    year: '2024',
    venue: 'ICML',
    tags: ['Agent', '代码', '工具调用'],
    status: 'unread',
    summary: '把仓库检索、AST 重构与测试执行包装成工具，让智能体在多轮交互中完成跨文件代码修改，并用测试反馈闭环。',
    notes: '还没开始读。先看第 4 节实验设置。',
    pages: [
      blocks(1, [
        ['title', 'Tool-Augmented Agents for Repository-Level Code Editing'],
        ['heading', 'Abstract'],
        ['body', 'Editing code at repository scale requires reasoning across many files and validating changes against executable tests. We present an agent that coordinates retrieval, abstract syntax tree rewriting and test execution as separate tools.'],
        ['body', 'Our approach improves pass rates on repository-level benchmarks by a significant margin over single-pass code generation baselines.'],
      ]),
      blocks(2, [
        ['heading', '4 Experiments'],
        ['body', 'We evaluate on a suite of realistic issue resolution tasks. The agent iterates until tests pass or a step budget is exhausted. Ablations show that test execution feedback contributes the largest single gain.'],
      ]),
    ],
  },
  {
    id: 'demo_multimodal',
    title: 'Unified Multimodal Representations for Image-Text Retrieval',
    authors: 'Li, Wang, Zhang',
    year: '2023',
    venue: 'CVPR',
    tags: ['多模态', '检索', '表示学习'],
    status: 'unread',
    summary: '用对比学习把图像与文本对齐到同一嵌入空间，提出难负样本挖掘策略提升检索召回。',
    notes: '',
    pages: [
      blocks(1, [
        ['title', 'Unified Multimodal Representations for Image-Text Retrieval'],
        ['heading', 'Abstract'],
        ['body', 'We propose a contrastive framework that aligns image and text encoders in a shared embedding space. A hard negative mining strategy is introduced to improve retrieval recall without additional annotation.'],
        ['body', 'Experiments on standard benchmarks show consistent improvements over strong dual-encoder baselines.'],
      ]),
    ],
  },
]

export function buildDemoPapers(): Paper[] {
  const now = Date.now()
  return SEEDS.map((seed, index) => ({
    id: seed.id,
    title: seed.title,
    authors: seed.authors,
    year: seed.year,
    venue: seed.venue,
    tags: seed.tags,
    status: seed.status,
    summary: seed.summary,
    notes: seed.notes,
    highlights:
      index === 0
        ? [
            {
              id: 'hl_demo_1',
              page: 1,
              blockId: 'p1b4',
              text: 'We introduce RAG models where the parametric memory is a pre-trained seq2seq model and the non-parametric memory is a dense vector index of Wikipedia',
              color: 'yellow' as const,
              note: '这就是 RAG 的定义句，参数化 + 非参数化双记忆。',
              createdAt: now - 86400000,
            },
          ]
        : [],
    pageCount: seed.pages.length,
    fileName: seed.id + '.demo',
    source: 'builtin' as const,
    textPages: seed.pages,
    addedAt: now - (index + 1) * 3600000,
    updatedAt: now - index * 600000,
    lastReadAt: seed.status === 'unread' ? 0 : now - index * 1200000,
  }))
}
