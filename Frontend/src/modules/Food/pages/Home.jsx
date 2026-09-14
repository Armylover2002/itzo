import { Link, useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import { ArrowRight, Utensils, Truck, Store, Globe, Heart, Shield, Clock } from "lucide-react"
import { motion } from "framer-motion"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@food/components/ui/card"
import { Button } from "@food/components/ui/button"
import {
  getCachedSettings,
  getAppLogo,
  subscribeBusinessSettings,
} from "@common/utils/businessSettings"


export default function Home() {
  const navigate = useNavigate()
  const [logoUrl, setLogoUrl] = useState(() => getAppLogo("user") || getCachedSettings()?.logo?.url || null)
  const [companyName, setCompanyName] = useState(() => getCachedSettings()?.companyName || "Appzeto Food")

  useEffect(() => {
    const apply = (settings) => {
      const userLogo = getAppLogo("user") || settings?.logo?.url
      if (userLogo) setLogoUrl(userLogo)
      if (settings?.companyName) setCompanyName(settings.companyName)
    }
    apply(getCachedSettings())
    return subscribeBusinessSettings(apply)
  }, [])
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-6">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={companyName}
                className="h-16 w-auto object-contain"
                onError={(e) => {
                  e.target.style.display = 'none'
                }}
              />
            ) : (
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
                <Utensils className="w-8 h-8 text-primary" />
              </div>
            )}
          </div>
          <CardTitle className="text-3xl font-bold text-center">{companyName || "Appzeto Food"}</CardTitle>
          <CardDescription className="text-lg">
            Welcome to the Food Delivery Platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <Link to="/user" className="block">
              <Button variant="outline" className="w-full h-24 flex flex-col items-center justify-center">
                <span className="text-2xl mb-2">??</span>
                <span className="font-semibold">User</span>
              </Button>
            </Link>
            <Link to="/restaurant" className="block">
              <Button variant="outline" className="w-full h-24 flex flex-col items-center justify-center">
                <span className="text-2xl mb-2">???</span>
                <span className="font-semibold">Restaurant</span>
              </Button>
            </Link>
            <Link to="/restaurant/auth/sign-in" className="block">
              <Button variant="outline" className="w-full h-24 flex flex-col items-center justify-center border-2 border-[#ff8100] hover:bg-[#ff8100]/10">
                <span className="text-2xl mb-2">??</span>
                <span className="font-semibold">Restaurant Login</span>
              </Button>
            </Link>
            <Link to="/delivery" className="block">
              <Button variant="outline" className="w-full h-24 flex flex-col items-center justify-center">
                <span className="text-2xl mb-2">??</span>
                <span className="font-semibold">Delivery</span>
              </Button>
            </Link>
            <Link to="/ecs/login" className="block">
              <Button variant="outline" className="w-full h-24 flex flex-col items-center justify-center">
                <span className="text-2xl mb-2">???</span>
                <span className="font-semibold">Admin</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

