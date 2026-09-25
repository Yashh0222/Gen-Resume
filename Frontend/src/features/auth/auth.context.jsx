import {createContext , useState} from "react"

export const AuthContext = createContext();

export const AuthProvider = ({children}) => {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    return (
        <AuthContext.Provider value = {{user, loading, error, setUser, setLoading, setError}}>
            {children}
        </AuthContext.Provider>
    )
}