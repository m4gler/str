/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT. THIS FILE IS NEEDED FOR THE PAYLOAD ADMIN UI. */
import { RootLayout } from '@payloadcms/next/layouts'
import { headers } from 'next/headers.js'
import React from 'react'

import config from '@/payload.config'
import '@payloadcms/next/css'
import './custom.css'

import { importMap } from './admin/importMap'
import { handleServerFunctions } from '@payloadcms/next/layouts'

export default async function Layout({ children }: { children: React.ReactNode }) {
    return (
        <RootLayout
            config={config}
            importMap={importMap}
            serverFunction={async (args) => {
                'use server'
                return handleServerFunctions({
                    ...args,
                    config,
                    importMap,
                })
            }}
        >
            {children}
        </RootLayout>
    )
}
