
  
  interface SubMenuItem {
    name: string; // Name of the sub-menu item
    desc: string; // Description of the sub-menu item
    icon: React.ElementType; // Icon component type
    link?: string;
  }
  
  // type for the main menu item
 export interface MainMenuItem {
    name: string; 
    subMenuHeading?: string[]; 
    subMenu?: SubMenuItem[]; 
    gridCols?: number; 
    link?: string;
  }

  // User profile types
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  avatar?: string;
}

// Account balance and wallet types
export interface AccountBalance {
  available: number;
  pending: number;
  total: number;
}

// Transaction types
export interface Transaction {
  id: string;
  taskId: string;
  taskTitle: string;
  taskDescription: string;
  type: "earned" | "spent";
  amount: number;
  fee: number;
  status: "completed" | "pending" | "refunded";
  date: Date;
  category: string;
}

// 2FA settings types
export interface TwoFASettings {
  enabled: boolean;
  method?: "sms" | "email" | "authenticator";
  phoneNumber?: string;
}

// Account settings types
export interface AccountSettings {
  twoFA: TwoFASettings;
  emailNotifications: boolean;
  pushNotifications: boolean;
}
