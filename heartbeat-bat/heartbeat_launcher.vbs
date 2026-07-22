Set objShell = CreateObject("WScript.Shell")
strDir = objShell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\BETNABISO"
strAgentId = WScript.Arguments(0)
strType    = WScript.Arguments(1)

strCmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & strDir & "\heartbeat.ps1"" -AgentId """ & strAgentId & """ -Type """ & strType & """"

' 0 = fenetre cachee, False = ne pas attendre la fin du processus
objShell.Run strCmd, 0, False
