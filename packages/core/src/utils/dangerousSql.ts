export interface DangerousSqlInfo {
  isDangerous: boolean
  severity: 'warning' | 'danger'
  message: string
  operation: string
}

const DANGEROUS_PATTERNS = [
  {
    pattern: /^\s*DROP\s+(DATABASE|SCHEMA)\b/i,
    severity: 'danger' as const,
    message: '此操作将永久删除数据库/模式，所有数据将丢失！',
    operation: 'DROP DATABASE/SCHEMA'
  },
  {
    pattern: /^\s*DROP\s+TABLE\b/i,
    severity: 'danger' as const,
    message: '此操作将永久删除表，所有数据将丢失！',
    operation: 'DROP TABLE'
  },
  {
    pattern: /^\s*TRUNCATE\s+TABLE?\b/i,
    severity: 'danger' as const,
    message: '此操作将清空表中所有数据，且无法回滚！',
    operation: 'TRUNCATE TABLE'
  },
  {
    pattern: /^\s*DELETE\s+FROM\s+\w+\s*$/i,
    severity: 'danger' as const,
    message: '此操作将删除表中所有行，且不带 WHERE 条件！',
    operation: 'DELETE without WHERE'
  },
  {
    pattern: /^\s*UPDATE\s+\w+\s+SET\s+\w+\s*=\s*.+$/i,
    severity: 'warning' as const,
    message: '此 UPDATE 语句可能不带 WHERE 条件，将更新表中所有行！',
    operation: 'UPDATE without WHERE'
  },
  {
    pattern: /^\s*DROP\s+(INDEX|VIEW|FUNCTION|PROCEDURE|TRIGGER|EVENT|SEQUENCE|TYPE|MATERIALIZED\s+VIEW)\b/i,
    severity: 'warning' as const,
    message: '此操作将删除数据库对象！',
    operation: 'DROP object'
  },
  {
    pattern: /^\s*ALTER\s+TABLE\s+\w+\s+DROP\b/i,
    severity: 'warning' as const,
    message: '此操作将从表中删除列或约束！',
    operation: 'ALTER TABLE DROP'
  },
  {
    pattern: /^\s*DROP\s+(ROLE|USER)\b/i,
    severity: 'warning' as const,
    message: '此操作将删除用户/角色！',
    operation: 'DROP ROLE/USER'
  }
]

export function detectDangerousSql(sql: string): DangerousSqlInfo {
  const trimmed = sql.trim()
  
  for (const { pattern, severity, message, operation } of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        isDangerous: true,
        severity,
        message,
        operation
      }
    }
  }
  
  return {
    isDangerous: false,
    severity: 'warning',
    message: '',
    operation: ''
  }
}

export function confirmDangerousOperation(info: DangerousSqlInfo, sql: string): Promise<boolean> {
  return new Promise((resolve) => {
    const title = info.severity === 'danger' ? '⚠️ 危险操作确认' : '⚠️ 警告操作确认'
    const confirmMessage = `${info.message}\n\n操作类型: ${info.operation}\n\nSQL:\n${info.severity === 'danger' ? '❗ ' : ''}${sql}`
    
    if (typeof window !== 'undefined' && window.confirm) {
      resolve(window.confirm(`${title}\n\n${confirmMessage}`))
    } else {
      resolve(false)
    }
  })
}