import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { motion } from 'framer-motion'
import { ZoomIn, Check, Palette } from 'lucide-react'
import getCroppedImg from '@/lib/canvasUtils'

interface ImageCropperProps {
    imageSrc: string
    onCropComplete: (croppedImage: Blob) => void
    onCancel: () => void
    aspectRatio?: number
}

const ImageCropper = ({ imageSrc, onCropComplete, onCancel, aspectRatio = 4 / 3 }: ImageCropperProps) => {
    const [crop, setCrop] = useState({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [bgColor, setBgColor] = useState('#000000')

    const onCropChange = useCallback((crop: { x: number, y: number }) => setCrop(crop), [])
    const onZoomChange = useCallback((zoom: number) => setZoom(zoom), [])
    const onCropCompleteCallback = useCallback((_: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels)
    }, [])

    const handleSave = async () => {
        try {
            setLoading(true)
            const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels, 0, { horizontal: false, vertical: false }, bgColor)
            if (croppedImage) {
                onCropComplete(croppedImage)
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[80vh] md:h-[600px]"
            >
                <div className="relative flex-1" style={{ backgroundColor: bgColor }}>
                    <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={aspectRatio}
                        onCropChange={onCropChange}
                        onCropComplete={onCropCompleteCallback}
                        onZoomChange={onZoomChange}
                        objectFit="contain"
                        restrictPosition={false}
                        style={{
                            containerStyle: { backgroundColor: bgColor },
                        }}
                    />
                </div>

                <div className="p-6 bg-white space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center gap-6">
                        <div className="flex-1 flex items-center gap-4">
                            <ZoomIn size={20} className="text-gray-400" />
                            <input
                                type="range"
                                value={zoom}
                                min={0.5}
                                max={3}
                                step={0.1}
                                aria-labelledby="Zoom"
                                onChange={(e) => setZoom(Number(e.target.value))}
                                className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-primary-600"
                            />
                        </div>

                        <div className="flex items-center gap-4 border-l border-gray-100 md:pl-6">
                            <Palette size={20} className="text-gray-400" />
                            <div className="flex gap-2">
                                {['#000000', '#ffffff', '#f3f4f6', '#fff7ed', '#ecfdf5'].map((color) => (
                                    <button
                                        key={color}
                                        onClick={() => setBgColor(color)}
                                        className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${bgColor === color ? 'border-primary-600 scale-110' : 'border-transparent'}`}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                                <input
                                    type="color"
                                    value={bgColor}
                                    onChange={(e) => setBgColor(e.target.value)}
                                    className="w-8 h-8 rounded-full border-2 border-transparent cursor-pointer p-0 overflow-hidden"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 justify-end">
                        <button
                            onClick={onCancel}
                            className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition-colors"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="px-8 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg flex items-center gap-2"
                        >
                            {loading ? (
                                <span>Processing...</span>
                            ) : (
                                <>
                                    <Check size={18} />
                                    <span>Save Crop</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}

export default ImageCropper
