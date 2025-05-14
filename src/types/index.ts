// src/types/index.ts
export interface Task {
    id: string;
    description: string;
    assigned_to_name: string;
    assigned_to_id: number;
    assigned_at: string; // ISO string
    due_by?: string;    // ISO string
    completed: boolean;
    completed_at?: string; // ISO string
    chat_id: number; // Chat donde se asignó o donde recordar
  }
  
  export interface TeamMemberConfig {
    [name: string]: number;
  }
  
  // Para las frases cargadas del JSON
  export interface FunPhrases {
    general_encouragement: string[];
    kaomoji_expressions: string[];
    developer_humor: string[];
    moe_responses: string[];
  }