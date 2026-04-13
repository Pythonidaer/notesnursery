tell application "Notes"
	set exportFolder to POSIX path of (path to desktop) & "notes-export/"
	do shell script "mkdir -p " & quoted form of exportFolder
	
	set logPath to exportFolder & "export-log.csv"
	set errorPath to exportFolder & "export-errors.txt"
	
	do shell script "printf %s " & quoted form of "index,title,created,modified,status,fileName" & " > " & quoted form of logPath
	do shell script "printf %s " & quoted form of "" & " > " & quoted form of errorPath
	
	set allNotes to every note
	set noteIndex to 1
	
	repeat with aNote in allNotes
		try
			set noteTitle to name of aNote
			set noteBody to body of aNote
			set createdDate to creation date of aNote
			set modifiedDate to modification date of aNote
			
			set safeTitle to do shell script "echo " & quoted form of noteTitle & " | tr '/:' '-' | tr -cd '[:alnum:] ._-' | sed 's/  */ /g' | sed 's/^ *//;s/ *$//'"
			if safeTitle is "" then set safeTitle to "untitled"
			
			set paddedIndex to text -4 thru -1 of ("0000" & noteIndex)
			set fileName to paddedIndex & " - " & safeTitle & ".md"
			set filePath to exportFolder & fileName
			
			set fileContent to "# " & noteTitle & return & return & noteBody & return & return & "Created: " & (createdDate as string) & return & "Modified: " & (modifiedDate as string)
			
			do shell script "printf %s " & quoted form of fileContent & " > " & quoted form of filePath
			
			set logLine to return & noteIndex & "," & my csvQuote(noteTitle) & "," & my csvQuote(createdDate as string) & "," & my csvQuote(modifiedDate as string) & ",exported," & my csvQuote(fileName)
			do shell script "printf %s " & quoted form of logLine & " >> " & quoted form of logPath
			
		on error errMsg number errNum
			set logLine to return & noteIndex & "," & my csvQuote("UNKNOWN_OR_FAILED") & ",,," & my csvQuote("failed " & errNum) & "," & my csvQuote("")
			do shell script "printf %s " & quoted form of logLine & " >> " & quoted form of logPath
			
			set errLine to "FAILED NOTE " & noteIndex & " | error " & errNum & " | " & errMsg & return
			do shell script "printf %s " & quoted form of errLine & " >> " & quoted form of errorPath
		end try
		
		set noteIndex to noteIndex + 1
		delay 0.05
	end repeat
end tell

on csvQuote(theText)
	set t to theText as string
	set t to my replaceText("\"", "\"\"", t)
	return "\"" & t & "\""
end csvQuote

on replaceText(findText, replaceWith, sourceText)
	set AppleScript's text item delimiters to findText
	set textItems to every text item of sourceText
	set AppleScript's text item delimiters to replaceWith
	set newText to textItems as string
	set AppleScript's text item delimiters to ""
	return newText
end replaceText
