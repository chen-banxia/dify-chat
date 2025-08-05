import {
	AppContextProvider,
	DEFAULT_APP_SITE_SETTING,
	ICurrentApp,
	IDifyAppItem,
} from '@dify-chat/core'
import { useMount, useRequest } from 'ahooks'
import { message, Spin } from 'antd'
import { useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import appService from '@/services/app'
import { createDifyApiInstance, DifyApi } from '@/utils/dify-api'

import MainLayout from './main-layout'

const SingleAppLayout = () => {
	const [selectedAppId, setSelectedAppId] = useState('')
	const [initLoading, setInitLoading] = useState(false)
	const [currentApp, setCurrentApp] = useState<ICurrentApp>() // 新增 currentApp 状态用于保存当前应用的 inf
	const { userId } = useAuth()

	const [difyApi] = useState(
		createDifyApiInstance({
			user: userId,
			apiBase: '',
			apiKey: '',
		}),
	)

	const { runAsync: getAppParameters } = useRequest(
		(difyApi: DifyApi) => {
			return difyApi.getAppParameters()
		},
		{
			manual: true,
		},
	)

	const { runAsync: getAppSiteSettting } = useRequest(
		(difyApi: DifyApi) => {
			return difyApi
				.getAppSiteSetting()
				.then(res => {
					return res
				})
				.catch(err => {
					console.error(err)
					console.warn(
						'Dify 版本提示: 获取应用 WebApp 设置失败，已降级为使用默认设置。如需与 Dify 配置同步，请确保你的 Dify 版本 >= v1.4.0',
					)
					return DEFAULT_APP_SITE_SETTING
				})
		},
		{
			manual: true,
		},
	)

	const initInSingleMode = async () => {
		const appList = await appService.getApps()
		const appConfig = appList[0] as IDifyAppItem
		if (!appConfig) {
			message.error('请先配置应用')
			return
		}
		difyApi.updateOptions({
			user: userId,
			apiBase: appConfig.requestConfig.apiBase,
			apiKey: appConfig.requestConfig.apiKey,
		})
		setInitLoading(true)
		const [difyAppInfo, appParameters, appSiteSetting] = await Promise.all([
			difyApi.getAppInfo(),
			getAppParameters(difyApi),
			getAppSiteSettting(difyApi),
		])
		// 获取应用信息
		setCurrentApp({
			config: {
				...appConfig,
				info: {
					...difyAppInfo,
					// 这里使用用户传入配置覆盖接口获取到的信息，是为了兼容旧版本(<=v1.3.1)的 /info 接口没有返回 mode 的情况
					...appConfig.info,
				},
			},
			parameters: appParameters,
			site: appSiteSetting,
		})
		setInitLoading(false)
	}

	// 初始化获取应用列表
	useMount(() => {
		initInSingleMode()
	})

	if (initLoading) {
		return (
			<div className="absolute w-full h-full left-0 top-0 z-50 flex items-center justify-center">
				<Spin spinning />
			</div>
		)
	}

	return (
		<>
			{currentApp ? (
				<AppContextProvider
					value={{
						appLoading: initLoading,
						currentAppId: selectedAppId,
						setCurrentAppId: setSelectedAppId,
						currentApp: currentApp,
						setCurrentApp,
					}}
				>
					<MainLayout
						difyApi={difyApi}
						initLoading={false}
						renderCenterTitle={appInfo => {
							return <>{appInfo?.name}</>
						}}
					/>
				</AppContextProvider>
			) : null}
		</>
	)
}

export default SingleAppLayout
