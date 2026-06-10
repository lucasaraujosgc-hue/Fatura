import * as Lucide from "lucide-react";
import React from "react";

export const CATEGORY_ICONS: Record<string, React.ComponentType<any>> = {
  Dumbbell: Lucide.Dumbbell,
  Utensils: Lucide.Utensils,
  CreditCard: Lucide.CreditCard,
  Wine: Lucide.Wine,
  Home: Lucide.Home,
  Heart: Lucide.Heart,
  ShoppingBag: Lucide.ShoppingBag,
  GraduationCap: Lucide.GraduationCap,
  ShoppingCart: Lucide.ShoppingCart,
  PawPrint: Lucide.PawPrint,
  Smile: Lucide.Smile,
  List: Lucide.List,
  Gift: Lucide.Gift,
  Car: Lucide.Car,
  Smartphone: Lucide.Smartphone,
  Coffee: Lucide.Coffee,
  Briefcase: Lucide.Briefcase,
  Plane: Lucide.Plane,
  Users: Lucide.Users,
  Gamepad2: Lucide.Gamepad2,
  Tv: Lucide.Tv,
  Activity: Lucide.Activity,
  PiggyBank: Lucide.PiggyBank,
  FileText: Lucide.FileText,
  Music: Lucide.Music,
  DollarSign: Lucide.DollarSign,
  Fuel: Lucide.Fuel,
  Scissors: Lucide.Scissors,
  Wrench: Lucide.Wrench,
  Percent: Lucide.Percent,
};

export const DEFAULT_ICON_NAME = "Tag";

export function CategoryIcon({ name, size = 16, className = "" }: { name: string; size?: number; className?: string }) {
  const IconComponent = CATEGORY_ICONS[name] || Lucide.Tag;
  return React.createElement(IconComponent, { size, className });
}
