import { Link } from "react-router-dom"
import { ArrowLeft, Accessibility as AccessibilityIcon, Eye, Volume2, MousePointerClick } from "lucide-react"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { Button } from "@food/components/ui/button"
import { Card, CardContent } from "@food/components/ui/card"
import { Switch } from "@food/components/ui/switch"
import { Label } from "@food/components/ui/label"
import { useState } from "react"

export default function Accessibility() {
  const [largeText, setLargeText] = useState(false)
  const [highContrast, setHighContrast] = useState(false)
  const [screenReader, setScreenReader] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)

  return (
    <AnimatedPage className="min-h-screen bg-[#f5f5f5] dark:bg-[#0a0a0a]">
      <div className="max-w-md md:max-w-2xl lg:max-w-3xl mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
        {/* Header */}
        <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-6 lg:mb-8">
          <Link to="/user/profile">
            <Button variant="ghost" size="icon" className="h-8 w-8 md:h-10 md:w-10 p-0">
              <ArrowLeft className="h-4 w-4 md:h-5 md:w-5 text-black dark:text-white" />
            </Button>
          </Link>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-black dark:text-white">Accessibility</h1>
        </div>

        {/* Info Card */}
        <Card className="py-0 bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm border-0 dark:border-gray-800 mb-4 md:mb-5 lg:mb-6">
          <CardContent className="p-4 md:p-5 lg:p-6">
            <div className="flex items-start gap-3 md:gap-4">
              <div className="bg-gray-100 dark:bg-gray-800 rounded-full p-2 md:p-3 mt-0.5">
                <AccessibilityIcon className="h-5 w-5 md:h-6 md:w-6 text-gray-700 dark:text-gray-300" />
              </div>
              <div className="flex-1">
                <h3 className="text-base md:text-lg lg:text-xl font-semibold text-gray-900 dark:text-white mb-1 md:mb-2">
                  Make the app more accessible
                </h3>
                <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
                  Customize your experience to better suit your needs and preferences.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Accessibility Options */}
        <div className="space-y-3 md:space-y-4 lg:space-y-5">
          <Card className="py-0 bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm border-0 dark:border-gray-800">
            <CardContent className="p-4 md:p-5 lg:p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 md:gap-4 flex-1">
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-full p-2 md:p-3">
                    <Eye className="h-5 w-5 md:h-6 md:w-6 text-gray-700 dark:text-gray-300" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-base md:text-lg font-medium text-gray-900 dark:text-white">
                      Large Text
                    </Label>
                    <p className="text-sm md:text-base text-gray-500 dark:text-gray-400">
                      Increase text size for better readability
                    </p>
                  </div>
                </div>
                <Switch
                  checked={largeText}
                  onCheckedChange={setLargeText}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="py-0 bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm border-0 dark:border-gray-800">
            <CardContent className="p-4 md:p-5 lg:p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 md:gap-4 flex-1">
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-full p-2 md:p-3">
                    <Eye className="h-5 w-5 md:h-6 md:w-6 text-gray-700 dark:text-gray-300" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-base md:text-lg font-medium text-gray-900 dark:text-white">
                      High Contrast
                    </Label>
                    <p className="text-sm md:text-base text-gray-500 dark:text-gray-400">
                      Enhance contrast for better visibility
                    </p>
                  </div>
                </div>
                <Switch
                  checked={highContrast}
                  onCheckedChange={setHighContrast}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="py-0 bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm border-0 dark:border-gray-800">
            <CardContent className="p-4 md:p-5 lg:p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 md:gap-4 flex-1">
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-full p-2 md:p-3">
                    <Volume2 className="h-5 w-5 md:h-6 md:w-6 text-gray-700 dark:text-gray-300" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-base md:text-lg font-medium text-gray-900 dark:text-white">
                      Screen Reader Support
                    </Label>
                    <p className="text-sm md:text-base text-gray-500 dark:text-gray-400">
                      Optimize for screen readers
                    </p>
                  </div>
                </div>
                <Switch
                  checked={screenReader}
                  onCheckedChange={setScreenReader}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="py-0 bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm border-0 dark:border-gray-800">
            <CardContent className="p-4 md:p-5 lg:p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 md:gap-4 flex-1">
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-full p-2 md:p-3">
                    <MousePointerClick className="h-5 w-5 md:h-6 md:w-6 text-gray-700 dark:text-gray-300" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-base md:text-lg font-medium text-gray-900 dark:text-white">
                      Reduce Motion
                    </Label>
                    <p className="text-sm md:text-base text-gray-500 dark:text-gray-400">
                      Minimize animations and transitions
                    </p>
                  </div>
                </div>
                <Switch
                  checked={reduceMotion}
                  onCheckedChange={setReduceMotion}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Additional Info */}
        <Card className="py-0 bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm border-0 dark:border-gray-800 mt-4 md:mt-5 lg:mt-6">
          <CardContent className="p-4 md:p-5 lg:p-6">
            <h3 className="text-base md:text-lg lg:text-xl font-semibold text-gray-900 dark:text-white mb-2 md:mb-3">
              Need more help?
            </h3>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mb-3 md:mb-4">
              If you need additional accessibility features or have suggestions, please contact our support team.
            </p>
            <Link to="/food/user/profile/support">
              <Button variant="outline" className="w-full text-sm md:text-base h-10 md:h-12">
                Contact Support
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </AnimatedPage>
  )
}

