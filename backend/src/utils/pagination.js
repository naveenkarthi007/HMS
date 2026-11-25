/**
 * Pagination, sorting and response helpers shared by every list endpoint.
 */

/** Upper bound on rows in one CSV export. */
const EXPORT_LIMIT = 10000;

function getPagination(query, maxLimit = 100) {
  // Exports reuse the list services with the same filters, but without the page-size cap.
  if (query.exportAll) return { page: 1, limit: EXPORT_LIMIT, offset: 0 };
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number(query.limit) || 10));
  return { page, limit, offset: (page - 1) * limit };
}

/**
 * Resolves `?sort=field` / `?sort=-field` against a whitelist of sortable columns.
 * @param {string|undefined} sort raw sort param
 * @param {Record<string,string>} allowed map of public field name -> SQL expression
 * @param {string} fallback default ORDER BY clause (without the keyword)
 */
function getSort(sort, allowed, fallback) {
  if (!sort) return fallback;
  const desc = sort.startsWith('-');
  const key = desc ? sort.slice(1) : sort;
  const column = allowed[key];
  if (!column) return fallback;
  return `${column} ${desc ? 'DESC' : 'ASC'}`;
}

function buildMeta({ page, limit }, total) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

function likeParam(search) {
  return `%${String(search).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/**
 * Small WHERE-clause builder that keeps SQL and parameters together.
 */
class Where {
  constructor() {
    this.clauses = [];
    this.params = [];
  }

  add(clause, ...params) {
    this.clauses.push(clause);
    this.params.push(...params);
    return this;
  }

  addIf(condition, clause, ...params) {
    if (condition !== undefined && condition !== null && condition !== '') this.add(clause, ...params);
    return this;
  }

  toSql() {
    return this.clauses.length ? `WHERE ${this.clauses.join(' AND ')}` : '';
  }
}

function sendList(res, rows, pagination, total) {
  res.json({ success: true, data: rows, meta: buildMeta(pagination, total) });
}

function sendData(res, data, status = 200) {
  res.status(status).json({ success: true, data });
}

module.exports = { EXPORT_LIMIT, getPagination, getSort, buildMeta, likeParam, Where, sendList, sendData };
