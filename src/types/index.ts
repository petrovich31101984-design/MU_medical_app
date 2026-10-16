// Типы данных для веб-приложения АлкоСпас

export interface Employee {
  id: string;
  personalNumber: string;
  fullName: string;
  password: string;
  status: string;
  position: string;
  hireDate: string;
  blocked: boolean;
  phone: string;
  lastActivity: string;
  note: string;
  shiftOpen: boolean;
  shiftStatus?: string;
}

export interface Nomenclature {
  id: string;
  name: string;
  category: string;
  unit: string;
  manufacturer: string;
  active: boolean;
  currentPrice: number;
  packageQuantity: number;
}

export interface ExpenseItem {
  nomenclatureId: string;
  name: string;
  category: string;
  quantity: number;
  pricePerUnit: number;
  total: number;
}

export interface ExpenseSheet {
  id: string;
  employeeId: string;
  employeeName: string;
  patientName: string;
  patientBirthDate: string;
  date: string;
  month: string;
  callCategory: string;
  therapyName: string;
  therapyCost: number;
  items: ExpenseItem[];
  totalAmount: number;
  archived: boolean;
}

export interface ChatMessage {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  role: string;
  text: string;
  date: string;
  read: boolean;
  priority: string;
}

export interface Announcement {
  id: string;
  title: string;
  text: string;
  recipients: string[];
  createdBy: string;
  date: string;
  active: boolean;
}

export interface AuthState {
  isAuthenticated: boolean;
  employee: Employee | null;
  token: string | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
