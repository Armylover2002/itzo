/**
 * Shared MUI icon map for header category iconId values.
 * Keep in sync with `categoryIcons` ids used by IconSelector / admin.
 */
import HomeIcon from "@mui/icons-material/Home";
import DevicesIcon from "@mui/icons-material/Devices";
import LocalGroceryStoreIcon from "@mui/icons-material/LocalGroceryStore";
import KitchenIcon from "@mui/icons-material/Kitchen";
import ChildCareIcon from "@mui/icons-material/ChildCare";
import PetsIcon from "@mui/icons-material/Pets";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import SpaIcon from "@mui/icons-material/Spa";
import ToysIcon from "@mui/icons-material/Toys";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import LocalHospitalIcon from "@mui/icons-material/LocalHospital";
import YardIcon from "@mui/icons-material/Yard";
import BusinessCenterIcon from "@mui/icons-material/BusinessCenter";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import CheckroomIcon from "@mui/icons-material/Checkroom";
import LocalCafeIcon from "@mui/icons-material/LocalCafe";
import DiamondIcon from "@mui/icons-material/Diamond";
import ColorLensIcon from "@mui/icons-material/ColorLens";
import BuildIcon from "@mui/icons-material/Build";
import LuggageIcon from "@mui/icons-material/Luggage";
import LocalPharmacyIcon from "@mui/icons-material/LocalPharmacy";
import AppleIcon from "@mui/icons-material/Apple";
import BakeryDiningIcon from "@mui/icons-material/BakeryDining";
import SetMealIcon from "@mui/icons-material/SetMeal";
import IcecreamIcon from "@mui/icons-material/Icecream";
import LocalDrinkIcon from "@mui/icons-material/LocalDrink";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import MedicationIcon from "@mui/icons-material/Medication";
import MedicalServicesIcon from "@mui/icons-material/MedicalServices";
import ScienceIcon from "@mui/icons-material/Science";
import FaceRetouchingNaturalIcon from "@mui/icons-material/FaceRetouchingNatural";

export const CATEGORY_ICON_COMPONENTS = {
  electronics: DevicesIcon,
  fashion: CheckroomIcon,
  home: HomeIcon,
  food: LocalCafeIcon,
  sports: SportsSoccerIcon,
  books: MenuBookIcon,
  beauty: SpaIcon,
  toys: ToysIcon,
  automotive: DirectionsCarIcon,
  pets: PetsIcon,
  health: LocalHospitalIcon,
  garden: YardIcon,
  office: BusinessCenterIcon,
  music: MusicNoteIcon,
  jewelry: DiamondIcon,
  baby: ChildCareIcon,
  tools: BuildIcon,
  luggage: LuggageIcon,
  art: ColorLensIcon,
  grocery: LocalGroceryStoreIcon,
  pharmacy: LocalPharmacyIcon,
  fruits_veg: AppleIcon,
  bakery: BakeryDiningIcon,
  meat_fish: SetMealIcon,
  snacks: IcecreamIcon,
  beverages: LocalDrinkIcon,
  cleaning: CleaningServicesIcon,
  personal_care: FaceRetouchingNaturalIcon,
  medicines: MedicationIcon,
  medical_services: MedicalServicesIcon,
  supplements: ScienceIcon,
  // Common aliases / kitchen-related
  kitchen: KitchenIcon,
};

export const resolveCategoryIconComponent = (iconId, fallback = null) => {
  if (!iconId) return fallback;
  return CATEGORY_ICON_COMPONENTS[iconId] || fallback;
};
