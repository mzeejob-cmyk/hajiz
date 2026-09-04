& {
    $ErrorActionPreference = 'Stop'
    $s1bPtr = [IntPtr]::Zero
    $s1bSecure = $null
    try {
        $s1bName = 'HAJIZ_STAGING_PUBLISHABLE_KEY'
        $s1bSecure = Read-Host 'Enter HAJIZ Staging publishable API key (hidden)' -AsSecureString
        if ($s1bSecure.Length -eq 0) { throw 'Empty input' }
        $s1bPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s1bSecure)
        $s1bPlain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($s1bPtr)
        if ($s1bPlain -notmatch '^sb_publishable_[A-Za-z0-9_-]+$') { throw 'Not a publishable key' }
        [Environment]::SetEnvironmentVariable($s1bName,$s1bPlain,'Process')
        Write-Host 'PUBLISHABLE KEY AVAILABLE'
    } catch { Write-Host 'PUBLISHABLE ENV CONFIGURATION BLOCKED'; throw }
    finally {
        if ($s1bPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($s1bPtr) }
        if ($null -ne $s1bSecure) { $s1bSecure.Dispose() }
        Remove-Variable s1bPlain,s1bSecure,s1bPtr -ErrorAction SilentlyContinue
        $Error.Clear()
    }
}
