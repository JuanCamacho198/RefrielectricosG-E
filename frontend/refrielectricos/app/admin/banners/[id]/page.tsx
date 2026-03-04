'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import LinkSelector from '@/components/admin/LinkSelector';
import Card from '@/components/ui/Card';
import ImageUploadWithCrop from '@/components/ui/ImageUploadWithCrop';
import { useToast } from '@/context/ToastContext';
import api from '@/lib/api';

interface BannerFormData {
  title: string;
  subtitle: string;
  imageUrl: string;
  link: string;
  buttonText: string;
  isActive: boolean;
  position: number;
  startsAt: string;
  endsAt: string;
}

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  link: string | null;
  buttonText: string | null;
  isActive: boolean;
  position: number;
  startsAt: string | null;
  endsAt: string | null;
}

export default function EditBannerPage() {
  const router = useRouter();
  const params = useParams();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const bannerId = params.id as string;

  const [formData, setFormData] = useState<BannerFormData>({
    title: '',
    subtitle: '',
    imageUrl: '',
    link: '',
    buttonText: '',
    isActive: true,
    position: 0,
    startsAt: '',
    endsAt: '',
  });

  // Fetch existing banner data
  const { data: banner, isLoading } = useQuery({
    queryKey: ['banner', bannerId],
    queryFn: async () => {
      const { data } = await api.get<Banner>(`/banners/${bannerId}`);
      return data;
    },
    enabled: !!bannerId,
  });

  // Populate form when banner data is loaded
  useEffect(() => {
    if (banner) {
      setFormData({
        title: banner.title,
        subtitle: banner.subtitle || '',
        imageUrl: banner.imageUrl,
        link: banner.link || '',
        buttonText: banner.buttonText || '',
        isActive: banner.isActive,
        position: banner.position,
        startsAt: banner.startsAt ? new Date(banner.startsAt).toISOString().slice(0, 16) : '',
        endsAt: banner.endsAt ? new Date(banner.endsAt).toISOString().slice(0, 16) : '',
      });
    }
  }, [banner]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<BannerFormData>) => api.patch(`/banners/${bannerId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banners-admin'] });
      queryClient.invalidateQueries({ queryKey: ['banner', bannerId] });
      queryClient.invalidateQueries({ queryKey: ['home-banners'] });
      addToast('Banner actualizado correctamente', 'success');
      router.push('/admin/banners');
    },
    onError: (error: any) => {
      addToast(error.response?.data?.message || 'Error al actualizar el banner', 'error');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload: any = {
      title: formData.title,
      imageUrl: formData.imageUrl,
      isActive: formData.isActive,
    };

    if (formData.subtitle) payload.subtitle = formData.subtitle;
    if (formData.link) payload.link = formData.link;
    if (formData.buttonText) payload.buttonText = formData.buttonText;
    if (formData.position > 0) payload.position = Number(formData.position);
    if (formData.startsAt) payload.startsAt = new Date(formData.startsAt).toISOString();
    if (formData.endsAt) payload.endsAt = new Date(formData.endsAt).toISOString();

    updateMutation.mutate(payload);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleImageChange = (url: string) => {
    setFormData((prev) => ({ ...prev, imageUrl: url }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Cargando banner...</p>
      </div>
    );
  }

  if (!banner) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Banner no encontrado</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/banners">
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Editar Banner</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Actualiza la información del banner
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Información Básica</h2>
          <div className="space-y-4">
            <Input
              label="Título del Banner"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              placeholder="¡Grandes descuentos de verano!"
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Subtítulo (Opcional)
              </label>
              <textarea
                name="subtitle"
                value={formData.subtitle}
                onChange={handleChange}
                rows={2}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Hasta 50% de descuento en productos seleccionados"
              />
            </div>
          </div>
        </Card>

        {/* Image Upload */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Imagen del Banner</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Imagen del Banner (Recomendado: 1920x600px)
              </label>
              <ImageUploadWithCrop
                value={formData.imageUrl}
                onChange={handleImageChange}
                showCropButton={true}
                aspectRatio={16 / 9}
              />
            </div>

            <Input
              label="O ingresa una URL directamente"
              name="imageUrl"
              value={formData.imageUrl}
              onChange={handleChange}
              placeholder="https://ejemplo.com/imagen.jpg"
            />
          </div>
        </Card>

        {/* Link & CTA */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Enlace y Botón</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LinkSelector
              label="Enlace de Destino"
              value={formData.link}
              onChange={(val) => setFormData(prev => ({ ...prev, link: val }))}
              placeholder="/products?category=ofertas"
            />

            <Input
              label="Texto del Botón"
              name="buttonText"
              value={formData.buttonText}
              onChange={handleChange}
              placeholder="Ver Ofertas"
            />
          </div>
        </Card>

        {/* Scheduling */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Programación</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Input
                label="Posición"
                name="position"
                type="number"
                value={formData.position}
                onChange={handleChange}
                min="0"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                0 = automático
              </p>
            </div>

            <div>
              <Input
                label="Fecha de Inicio"
                name="startsAt"
                type="datetime-local"
                value={formData.startsAt}
                onChange={handleChange}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Opcional
              </p>
            </div>

            <div>
              <Input
                label="Fecha de Fin"
                name="endsAt"
                type="datetime-local"
                value={formData.endsAt}
                onChange={handleChange}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Opcional
              </p>
            </div>
          </div>
        </Card>

        {/* Status */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Banner Activo</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                El banner se mostrará en el carrusel
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, isActive: !prev.isActive }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                formData.isActive ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                  formData.isActive ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link href="/admin/banners">
            <Button type="button" variant="secondary">
              Cancelar
            </Button>
          </Link>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <>Guardando...</>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Guardar Cambios
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
