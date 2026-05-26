import logging
import os
from collections import defaultdict

from dotenv import load_dotenv

# Load env vars from the project root .env.local when available.
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env.local'))

NEO4J_URI = os.getenv('NEO4J_URI', '')
NEO4J_USER = os.getenv('NEO4J_USER', '')
NEO4J_PASSWORD = os.getenv('NEO4J_PASSWORD', '')

logger = logging.getLogger('query')

NODE_POSITIONS = {
	'Scheme': (430, 250),
	'State': (700, 120),
	'Category': (150, 120),
	'Gender': (150, 390),
	'Eligibility': (430, 430),
	'Benefit': (700, 390),
}


def get_driver():
	missing = [name for name, val in [('NEO4J_URI', NEO4J_URI), ('NEO4J_USER', NEO4J_USER), ('NEO4J_PASSWORD', NEO4J_PASSWORD)] if not val]
	if missing:
		logger.warning("Neo4j driver not created — missing env vars: %s", missing)
		return None

	logger.info("Creating Neo4j driver — uri=%s, user=%s", NEO4J_URI, NEO4J_USER)
	from neo4j import GraphDatabase

	try:
		driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
		logger.info("Neo4j driver created successfully")
		return driver
	except Exception as exc:
		logger.exception("Failed to create Neo4j driver: %s", exc)
		return None


def _fallback_scheme_name(data: dict, s3_key: str) -> str:
	scheme_name = (data.get('name') or '').strip()
	if not scheme_name or scheme_name == 'NOT_FOUND':
		scheme_name = os.path.basename(s3_key).replace('.pdf', '') or 'Unknown Scheme'
	return scheme_name[:32] if len(scheme_name) > 32 else scheme_name


def build_graph_data(data: dict, s3_key: str) -> dict:
	logger.info("build_graph_data (fallback) called — data=%s, s3_key=%s", data, s3_key)
	scheme_name = _fallback_scheme_name(data, s3_key)
	state = data.get('state', 'Unknown')
	if state == 'NOT_FOUND':
		state = 'Unknown State'
	category = data.get('category', 'General')
	if category == 'NOT_FOUND':
		category = 'General'
	gender = data.get('gender', 'All')
	if gender == 'NOT_FOUND':
		gender = 'All'
	income_limit = data.get('income_limit', 0) or 0
	benefit_amount = data.get('benefit_amount', 0) or 0

	nodes = [
		{
			'id': 'scheme',
			'label': scheme_name,
			'kind': 'Scheme',
			'x': 430,
			'y': 250,
			'properties': {'source': s3_key, 'status': 'Active'},
		},
		{
			'id': 'state',
			'label': state,
			'kind': 'State',
			'x': 700,
			'y': 120,
			'properties': {'type': 'State'},
		},
		{
			'id': 'category',
			'label': category,
			'kind': 'Category',
			'x': 150,
			'y': 120,
			'properties': {'category': category},
		},
		{
			'id': 'gender',
			'label': gender,
			'kind': 'Gender',
			'x': 150,
			'y': 390,
			'properties': {'gender': gender},
		},
	]

	edges = [
		{'id': 'e1', 'source': 'scheme', 'target': 'state', 'relationship': 'AVAILABLE_IN'},
		{'id': 'e2', 'source': 'scheme', 'target': 'category', 'relationship': 'HAS_CATEGORY'},
		{'id': 'e3', 'source': 'scheme', 'target': 'gender', 'relationship': 'FOR_GENDER'},
	]

	if income_limit > 0:
		nodes.append(
			{
				'id': 'income',
				'label': f'Income ≤ ₹{income_limit:,}',
				'kind': 'Eligibility',
				'x': 430,
				'y': 430,
				'properties': {'rule': f'annual_income <= {income_limit}'},
			}
		)
		edges.append({'id': 'e4', 'source': 'scheme', 'target': 'income', 'relationship': 'APPLIES_TO'})

	if benefit_amount > 0:
		nodes.append(
			{
				'id': 'benefit',
				'label': f'₹{benefit_amount:,} Benefit',
				'kind': 'Benefit',
				'x': 700,
				'y': 390,
				'properties': {'amount': f'₹{benefit_amount:,}'},
			}
		)
		edges.append({'id': 'e5', 'source': 'scheme', 'target': 'benefit', 'relationship': 'HAS_BENEFIT'})

	return {'nodes': nodes, 'edges': edges}


def _stringify_properties(properties: dict) -> dict:
	return {key: str(value) for key, value in properties.items() if value is not None}


def _node_kind(node) -> str:
	labels = list(node.labels)
	for kind in ('Scheme', 'State', 'Category', 'Gender', 'Eligibility', 'Benefit'):
		if kind in labels:
			return kind
	return labels[0] if labels else 'Entity'


def _node_id(node) -> str:
	kind = _node_kind(node)
	if kind == 'Scheme':
		return f"scheme:{node.get('name', node.element_id)}"
	if kind == 'State':
		return f"state:{node.get('name', node.element_id)}"
	if kind == 'Category':
		return f"category:{node.get('name', node.element_id)}"
	if kind == 'Gender':
		return f"gender:{node.get('type', node.element_id)}"
	if kind == 'Eligibility':
		return f"eligibility:{node.get('limit', node.element_id)}"
	if kind == 'Benefit':
		return f"benefit:{node.get('amount', node.element_id)}"
	return f"entity:{node.element_id}"


def _node_label(node, fallback_data: dict | None = None, s3_key: str = '') -> str:
	kind = _node_kind(node)
	if kind == 'Scheme':
		return node.get('name') or _fallback_scheme_name(fallback_data or {}, s3_key)
	if kind in ('State', 'Category'):
		return node.get('name') or kind
	if kind == 'Gender':
		return node.get('type') or 'All'
	if kind == 'Eligibility':
		limit = node.get('limit')
		if limit is not None:
			return f'Income ≤ ₹{int(limit):,}'
		return node.get('rule') or 'Eligibility'
	if kind == 'Benefit':
		amount = node.get('amount')
		if amount is not None:
			return f'₹{int(amount):,} Benefit'
		return node.get('label') or 'Benefit'
	return node.get('name') or node.element_id


def _position_for_kind(kind: str, counts: dict[str, int]) -> tuple[int, int]:
	base_x, base_y = NODE_POSITIONS.get(kind, (430, 250))
	index = counts[kind]
	counts[kind] += 1
	if index == 0:
		return base_x, base_y
	return base_x + (index * 24), base_y + (index * 16)


def _graph_from_neo4j_records(records, fallback_data: dict | None, s3_key: str) -> dict:
	nodes_by_id = {}
	edges = []
	counts = defaultdict(int)

	for record in records:
		source = record.get('s')
		relation = record.get('r')
		target = record.get('n')

		if source is not None:
			source_id = _node_id(source)
			if source_id not in nodes_by_id:
				kind = _node_kind(source)
				x, y = _position_for_kind(kind, counts)
				nodes_by_id[source_id] = {
					'id': source_id,
					'label': _node_label(source, fallback_data, s3_key),
					'kind': kind,
					'x': x,
					'y': y,
					'properties': _stringify_properties(dict(source.items())),
				}

		if target is not None:
			target_id = _node_id(target)
			if target_id not in nodes_by_id:
				kind = _node_kind(target)
				x, y = _position_for_kind(kind, counts)
				nodes_by_id[target_id] = {
					'id': target_id,
					'label': _node_label(target, fallback_data, s3_key),
					'kind': kind,
					'x': x,
					'y': y,
					'properties': _stringify_properties(dict(target.items())),
				}

		if relation is not None and source is not None and target is not None:
			edges.append(
				{
					'id': f"{source.element_id}:{relation.type}:{target.element_id}",
					'source': _node_id(source),
					'target': _node_id(target),
					'relationship': relation.type,
				}
			)

	if not nodes_by_id:
		return build_graph_data(fallback_data or {}, s3_key)

	return {'nodes': list(nodes_by_id.values()), 'edges': edges}


def insert_scheme(tx, scheme: dict, source: str | None = None):
	payload = dict(scheme)
	if source is not None:
		payload['source'] = source

	payload.setdefault('income_limit', 0)
	payload.setdefault('benefit_amount', 0)

	logger.info(
		"insert_scheme — name=%r, state=%r, category=%r, gender=%r, income_limit=%s, benefit_amount=%s, source=%r",
		payload.get('name'), payload.get('state'), payload.get('category'),
		payload.get('gender'), payload.get('income_limit'), payload.get('benefit_amount'), source,
	)

	tx.run(
		"""
		MERGE (s:Scheme {name: $name})
		SET s.income_limit = $income_limit,
			s.benefit_amount = $benefit_amount
		FOREACH (_ IN CASE WHEN $source IS NOT NULL THEN [1] ELSE [] END |
			SET s.source = $source
		)
		MERGE (st:State {name: $state})
		MERGE (c:Category {name: $category})
		MERGE (g:Gender {type: $gender})
		MERGE (s)-[:AVAILABLE_IN]->(st)
		MERGE (s)-[:HAS_CATEGORY]->(c)
		MERGE (s)-[:FOR_GENDER]->(g)
		FOREACH (_ IN CASE WHEN coalesce($income_limit, 0) > 0 THEN [1] ELSE [] END |
			MERGE (e:Eligibility {limit: $income_limit})
			SET e.rule = 'annual_income <= ' + toString($income_limit)
			MERGE (s)-[:APPLIES_TO]->(e)
		)
		FOREACH (_ IN CASE WHEN coalesce($benefit_amount, 0) > 0 THEN [1] ELSE [] END |
			MERGE (b:Benefit {amount: $benefit_amount})
			SET b.label = '₹' + toString($benefit_amount) + ' Benefit'
			MERGE (s)-[:HAS_BENEFIT]->(b)
		)
		""",
		**payload,
	)


def fetch_scheme_graph(scheme_name: str, fallback_data: dict | None = None, s3_key: str = '') -> dict:
	logger.info("fetch_scheme_graph — scheme_name=%r, s3_key=%s", scheme_name, s3_key)
	driver = get_driver()
	if driver is None:
		logger.warning("fetch_scheme_graph: no Neo4j driver — returning fallback graph")
		return build_graph_data(fallback_data or {}, s3_key)

	try:
		logger.info("Running Neo4j MATCH for scheme: %r", scheme_name)
		with driver.session() as session:
			result = session.run(
				"""
				MATCH (s:Scheme {name: $scheme_name})
				OPTIONAL MATCH (s)-[r]->(n)
				RETURN s, r, n
				""",
				scheme_name=scheme_name,
			)
			records = list(result)

		logger.info("Neo4j query returned %d record(s) for scheme: %r", len(records), scheme_name)
		if not records:
			logger.warning("No Neo4j records found for scheme=%r — using fallback graph", scheme_name)
			return build_graph_data(fallback_data or {}, s3_key)

		graph = _graph_from_neo4j_records(records, fallback_data, s3_key)
		logger.info("Built graph from Neo4j — nodes=%d, edges=%d", len(graph.get('nodes', [])), len(graph.get('edges', [])))
		return graph
	except Exception as exc:
		logger.exception("Neo4j read failed for scheme=%r: %s", scheme_name, exc)
		return build_graph_data(fallback_data or {}, s3_key)
	finally:
		driver.close()


def fetch_browser_graph(s3_key: str = '') -> dict:
	logger.info("fetch_browser_graph called — s3_key=%s", s3_key)
	driver = get_driver()
	if driver is None:
		logger.warning("fetch_browser_graph: no Neo4j driver — returning empty graph")
		return {'nodes': [], 'edges': []}

	try:
		with driver.session() as session:
			result = session.run(
				"""
				MATCH (a)-[r]->(b)
				RETURN a, r, b
				"""
			)
			records = list(result)

		logger.info("fetch_browser_graph: Neo4j returned %d record(s)", len(records))
		if not records:
			logger.warning("fetch_browser_graph: no records found — returning empty graph")
			return {'nodes': [], 'edges': []}

		graph = _graph_from_neo4j_records_browser(records, s3_key)
		logger.info("fetch_browser_graph: built graph — nodes=%d, edges=%d", len(graph.get('nodes', [])), len(graph.get('edges', [])))
		return graph
	except Exception as exc:
		logger.exception("Neo4j browser graph read failed: %s", exc)
		return {'nodes': [], 'edges': []}
	finally:
		driver.close()


def _graph_from_neo4j_records_browser(records, s3_key: str) -> dict:
	nodes_by_id = {}
	edges = []
	counts = defaultdict(int)

	for record in records:
		source = record.get('a')
		relation = record.get('r')
		target = record.get('b')

		if source is not None:
			source_id = _node_id(source)
			if source_id not in nodes_by_id:
				kind = _node_kind(source)
				x, y = _position_for_kind(kind, counts)
				nodes_by_id[source_id] = {
					'id': source_id,
					'label': _node_label(source, None, s3_key),
					'kind': kind,
					'x': x,
					'y': y,
					'properties': _stringify_properties(dict(source.items())),
				}

		if target is not None:
			target_id = _node_id(target)
			if target_id not in nodes_by_id:
				kind = _node_kind(target)
				x, y = _position_for_kind(kind, counts)
				nodes_by_id[target_id] = {
					'id': target_id,
					'label': _node_label(target, None, s3_key),
					'kind': kind,
					'x': x,
					'y': y,
					'properties': _stringify_properties(dict(target.items())),
				}

		if relation is not None and source is not None and target is not None:
			edges.append(
				{
					'id': f"{source.element_id}:{relation.type}:{target.element_id}",
					'source': _node_id(source),
					'target': _node_id(target),
					'relationship': relation.type,
				}
			)

	return {'nodes': list(nodes_by_id.values()), 'edges': edges}
